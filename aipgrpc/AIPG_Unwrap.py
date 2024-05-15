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

def handle_aipg_unwrap(user_eth_address, wAIPG_amount, user_aipg_address, user_tx_hash):
    messages = []
    messages.append("Processing wAIPG unwrap...")

    # Wait for user to transfer wAIPG to admin for burning
    messages.append(f"Checking for the transfer to be detected... using {user_tx_hash} to verify!")
    try:
        # Wait for the transaction to be mined and obtain its receipt
        receipt = web3.eth.wait_for_transaction_receipt(user_tx_hash)
        
        # Verify the transaction
        if receipt:
            # Verify if the transaction is to the admin address and the amount is correct
            #tx = web3.eth.getTransaction(user_tx_hash)
            transfer_verified = False
            transfer_events = wAIPG_contract.events.Transfer().process_receipt(receipt)
            for event in transfer_events:
                if event['args']['to'].lower() == admin_address.lower() and event['args']['from'].lower() == user_eth_address.lower() and event['args']['value'] == wAIPG_amount:
                    transfer_verified = True
                    break

            if transfer_verified:
                messages.append("Your transfer of wAIPG to the admin address was verified!")
                messages.append("Burning wAIPG on Ethereum...")
                if not isinstance(user_eth_address, str):
                    messages.append(f"{user_eth_address} --> User account address is not set correctly.")
                    return
                wAIPG_burned = False
                while not wAIPG_burned:
                    try:
                        wAIPG_burn_amount = int(wAIPG_amount * 0.95)
                        nonce = web3.eth.get_transaction_count(admin_address)
   
                        # Dynamically estimate gas price and limit
                        estimatedGasBurn = wAIPG_contract.functions.burn(admin_address, wAIPG_burn_amount).estimate_gas({
                            'from': admin_address
                        })

                        txnBurn = wAIPG_contract.functions.burn(admin_address, wAIPG_burn_amount).build_transaction({
                            'chainId': web3.eth.chain_id,
                            'gas': estimatedGasBurn,
                            'gasPrice': web3.eth.gas_price,
                            'nonce': nonce,
                        })

                        # Sign the transaction with the admin's private key
                        signed_txnBurn = web3.eth.account.sign_transaction(txnBurn, admin_private_key)

                        # Send the transaction
                        txnBurn_hash = web3.eth.send_raw_transaction(signed_txnBurn.rawTransaction)

                        # Wait for the transaction to be mined
                        tx_receipt = web3.eth.wait_for_transaction_receipt(txnBurn_hash)

                        if tx_receipt:
                            wAIPG_burned = True
                            messages.append(f'wAIPG was burned successfully, minus the 5% fee.')
                            aipg_amount = int(wAIPG_burn_amount / (10**18))
                            aipg.sendtoaddress(user_aipg_address, aipg_amount)
                            messages.append("AIPG Released!")

                    except Exception as e:
                        messages.append(f"An error occurred: {e}")

            else:
                messages.append("Failed to verify the transfer. Please check the transaction hash and try again.")
    
    except Exception as e:
        messages.append(f"An error occurred: {e}")

    wAIPG_balance = wAIPG_contract.functions.balanceOf(admin_address).call()
    messages.append(f'wAIPG balance for {admin_address}:', wAIPG_balance)

    return messages
