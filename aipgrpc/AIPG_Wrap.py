import json
import time
import os
from web3 import Web3
from web3.auto import w3
from decimal import Decimal
from dotenv import load_dotenv
from aipgrpc import Aipowergrid

load_dotenv()

# Setup Ethereum connection
web3 = Web3(Web3.HTTPProvider('http://127.0.0.1:8545'))

# Securely load the admin's private key from an environment variable
admin_private_key = os.getenv("ADMPK")

# Create an account object from the private key
admin_account = w3.eth.account.from_key(admin_private_key)

admin_address = admin_account.address

# Contract Address
wAIPG_contract_address = os.getenv("wAIPGCA")

# Specify the path to the JSON file
abi_file_path = os.getenv("ABIFP")

# Load the entire JSON data from the file
with open(abi_file_path, 'r') as abi_file:
    json_data = json.load(abi_file)

# Extract the ABI part from the JSON data
wAIPG_abi = json_data['abi']

wAIPG_contract = web3.eth.contract(address=wAIPG_contract_address, abi=wAIPG_abi)

# Setup Aipowergrid connection
aipguser = os.getenv("AUSER")
aipgpass = os.getenv("APASS")
aipg = Aipowergrid(aipguser, aipgpass, 'localhost', 9788)

def handle_waipg_mint(wrap_amount, user_eth_address):
    # messages = [] List to store messages for display via flask
    aipg_amount = float(wrap_amount)
    user_aipg_address_json = aipg.getnewaddress()  # This keeps the coins on the AIPG node for the burn
    user_aipg_address = user_aipg_address_json['result']
    # messages.append(f"Send {aipg_amount} AIPG to this Aipowergrid address: {user_aipg_address}")
    yield(f"Send {aipg_amount} AIPG to this Aipowergrid address: {user_aipg_address}")


    yield("Waiting for AIPG deposit...<br>")
    transaction_confirmed = False
    while not transaction_confirmed:
        time.sleep(10)
        yield("Waiting another 10 seconds for AIPG deposit...<br>")
        unspent_transactions_full_json = aipg.listunspent()
        unspent_transactions = unspent_transactions_full_json['result']
        yield(str(unspent_transactions))

        # Check if unspent_transactions is empty
        if not unspent_transactions or len(unspent_transactions) == 0:
            yield("No unspent transactions found at this time.")
            continue

        # Iterate over transactions
        for tx in unspent_transactions:
            yield(f"Checking transaction: {tx}")
            if tx['address'] == user_aipg_address and float(tx['amount']) >= aipg_amount:
                transaction_confirmed = True
                yield("AIPG deposit confirmed!")
                break  # Exit the loop once a matching transaction is found

        if transaction_confirmed:
            yieldd("Proceeding with next steps...\n")
        else:
            yield("No matching transaction found yet...\n")

    yield("Issuing wAIPG on Ethereum...")
    if not isinstance(user_eth_address, str):
            yield(f"{user_eth_address} --> User account address is not set correctly.")
            return
    wAIPG_issued = False
    while not wAIPG_issued:
        try:
            nonce = web3.eth.get_transaction_count(admin_address)
            mint_amount = int(aipg_amount * (10**18))

            # Dynamically estimate gas price and limit
            estimatedGasMint = wAIPG_contract.functions.mint(admin_address, mint_amount).estimate_gas({
              'from': admin_address
            })

            txnMint = wAIPG_contract.functions.mint(admin_address, mint_amount).build_transaction({
                'chainId': web3.eth.chain_id,
                'gas': estimatedGasMint,
                'gasPrice': web3.eth.gas_price,
                'nonce': nonce,
            })

            # Sign the transaction with the admin's private key
            signed_txnMint = web3.eth.account.sign_transaction(txnMint, admin_private_key)

            # Send the transaction
            txMint_hash = web3.eth.send_raw_transaction(signed_txnMint.rawTransaction)

            # Wait for the transaction to be mined
            tx_receipt = web3.eth.wait_for_transaction_receipt(txMint_hash)
            if tx_receipt:
                yield("wAIPG issued to admin successfully!")

                # Prepare the transfer transaction
                transfer_amount = int(mint_amount * 0.95)
                nonce += 1  # Increment nonce for the next transaction

                estimatedGasTransfer = wAIPG_contract.functions.transfer(user_eth_address, transfer_amount).estimate_gas({
                  'from': admin_address
                })

                txn_transfer = wAIPG_contract.functions.transfer(user_eth_address, transfer_amount).build_transaction({
                    'chainId': web3.eth.chain_id,
                    'gas': estimatedGasTransfer,
                    'gasPrice': web3.eth.gas_price,
                    'nonce': nonce,
                })

                # Sign and send the transfer transaction
                signed_txn_transfer = web3.eth.account.sign_transaction(txn_transfer, admin_private_key)
                tx_hash_transfer = web3.eth.send_raw_transaction(signed_txn_transfer.rawTransaction)
                transfer_tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash_transfer)

                if transfer_tx_receipt:
                    wAIPG_issued = True
                    yield(f'wAIPG transferred to user address: {user_eth_address}, successfully, minus the 5% fee.')

        except Exception as e:
            yield(f"An error has occured {e}")
            yield("Waiting another 10 seconds for wAIPG to be issued and delivered...")
            time.sleep(10)

    wAIPG_balance = wAIPG_contract.functions.balanceOf(user_eth_address).call()
    yield(f'wAIPG balance for {user_eth_address}:', wAIPG_balance)