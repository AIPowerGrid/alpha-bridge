import json
import time
import os
from web3 import Web3
from web3.auto import w3
from decimal import Decimal
from dotenv import load_dotenv

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

def handle_waipg_transfer():
    print(f"Facilitating transfer of wAIPG on Ethereum from User to {admin_address}")
    user_eth_address = input("Enter your Ethereum address: ")
    user_pk = input("Enter your Ethereum address privkey, this will not be saved in any way: ")
    if not isinstance(user_eth_address, str):
            print(user_eth_address)
            print("User account address is not set correctly.")
            return
    transfer_amount = int(input("Enter the amount of wAIPG to transfer to the Admin address (in wei format, ex: 39900000000000000000 --> 39.9 wAIPG, 10^18 conversion factor): "))
    wAIPG_sent = False
    while not wAIPG_sent:
        try:
            nonce = web3.eth.get_transaction_count(user_eth_address)

            # Dynamically estimate gas price and limit
            estimatedGas = wAIPG_contract.functions.transfer(admin_address, transfer_amount).estimate_gas({
              'from': user_eth_address
            })

            txn = wAIPG_contract.functions.transfer(admin_address, transfer_amount).build_transaction({
                'chainId': web3.eth.chain_id,
                'gas': estimatedGas,
                'gasPrice': web3.eth.gas_price,
                'nonce': nonce,
            })

            # Sign the transaction with the admin's private key
            signed_txn = web3.eth.account.sign_transaction(txn, user_pk)

            # Send the transaction
            tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
            hex_tx_hash = tx_hash.hex()
            print(f"This is the raw transaction hash for the unwrap: {tx_hash}")
            print(f"This is the hexidecimal transaction hash for the unwrap: {hex_tx_hash}")

            # Wait for the transaction to be mined
            tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
            if tx_receipt:
                wAIPG_sent = True
                print("wAIPG sent to admin successfully.")

        except Exception as e:
            print(e)
            print("Waiting another 10 seconds for wAIPG to be transfered...")
            time.sleep(10)

    wAIPG_balance = wAIPG_contract.functions.balanceOf(admin_address).call()
    print(f'wAIPG balance for {admin_address}:', wAIPG_balance)

handle_waipg_transfer()