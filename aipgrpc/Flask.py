from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import logging
import os
from AIPG_Wrap import handle_waipg_mint
from AIPG_Unwrap import handle_aipg_unwrap

app = Flask(__name__)
app.secret_key = os.urandom(24)
socketio = SocketIO(app)
logging.basicConfig(level=logging.DEBUG)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('wrap')
def handle_wrap(data):
    logging.debug("Received wrap request")
    amount = data['amount']
    eth_address = data['eth_address']
    if amount and eth_address:
        try:
            logging.debug("Calling handle_waipg_mint")
            mint_process = handle_waipg_mint(amount, eth_address)
            for message in mint_process:
                emit('message', {'text': message})  # Emitting message to the client
        except Exception as e:
            logging.error(f"Error in handle_waipg_mint: {str(e)}")
            emit('error', {'text': str(e)})
    else:
        emit('error', {'text': 'Missing amount or Ethereum address!'})

@socketio.on('unwrap')
def handle_unwrap(data):
    logging.debug("Received unwrap request")
    amount = data['amount']
    eth_address = data['eth_address']
    aipg_address = data['aipg_address']
    tx_hash = data['tx_hash']
    if amount and eth_address and aipg_address and tx_hash:
        try:
            messages = handle_aipg_unwrap(eth_address, amount, aipg_address, tx_hash)
            for message in messages:
                emit('message', {'text': message})  # Emitting message to the client
        except Exception as e:
            logging.error(f"An error occurred: {str(e)}")
            emit('error', {'text': str(e)})
    else:
        emit('error', {'text': 'All fields must be filled!'})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', debug=True)