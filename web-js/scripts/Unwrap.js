// Import necessary libraries
require('dotenv').config();
const { Web3 } = require('web3');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const { getRPC, methods } = require('@ravenrebels/ravencoin-rpc');

// Function to handle unwrapping
async function handleAIPGUnwrap(socket, data) {
    // Setup Ethereum connection
    const web3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
    const adminPrivateKey = process.env.ADMPK;
    const adminAccount = web3.eth.accounts.privateKeyToAccount(adminPrivateKey);

    // Load contract ABI
    const wAIPGAbiFull = JSON.parse(fs.readFileSync(process.env.ABIFP, 'utf8'));
    const wAIPGAbi = wAIPGAbiFull['abi'];
    const wAIPGContract = new web3.eth.Contract(wAIPGAbi, process.env.wAIPGCA);

    // Setup Aipowergrid connection using ravencoin-rpc
    const user = process.env.AUSER;
    const pass = process.env.APASS;
    const connect = "http://localhost:9788";
    const rpc = getRPC(user, pass, connect);
    const userEthAddress = data.userEthAddress;
    const wAIPGAmount = new BigNumber(data.wAIPGAmount);
    const userAIPGHoldingAddress = data.userAIPGHoldingAddress;
    const userAIPGReceivingAddress = data.userAIPGReceivingAddress;
    const userTxHash = data.userTxHash;

    try {
        const receipt = await web3.eth.getTransactionReceipt(userTxHash);
        if (!receipt) {
            socket.emit('output', "No transaction receipt was found. Please check the transaction hash and try again.");
            return;
        }
        let transferVerified = false;

        // Assuming you have initialized `wAIPGContract` with the ABI and address correctly elsewhere in your script
        const transferEvents = await wAIPGContract.getPastEvents('Transfer', {
            filter: { to: adminAccount.address, from: userEthAddress }, // Only get relevant Transfer events
            fromBlock: receipt.blockNumber,
            toBlock: receipt.blockNumber
        });

        // Verify the transaction details within the filtered events
        transferEvents.forEach(event => {
            const eventValue = new BigNumber(event.returnValues.value);
            // Compare both addresses and the value; ensure addresses are compared in a case-insensitive manner
            if (event.returnValues.to.toLowerCase() === adminAccount.address.toLowerCase() &&
                event.returnValues.from.toLowerCase() === userEthAddress.toLowerCase() &&
                eventValue.isEqualTo(wAIPGAmount.multipliedBy(new BigNumber(10).pow(18)))) {
                transferVerified = true;
            }
        });

        if (transferVerified) {
            socket.emit('output', "Your transfer of wAIPG to the admin address was verified!");
            socket.emit('output', "Burning wAIPG on Ethereum...");

            const nonce = await web3.eth.getTransactionCount(adminAccount.address);
            const burnAmountInWei = wAIPGAmount.multipliedBy(new BigNumber(10).pow(18));
            const burnAmount = burnAmountInWei.toString();
            const gasPrice = await web3.eth.getGasPrice();
            const chainId = await web3.eth.getChainId();
            const gasEstimate = await wAIPGContract.methods.burn(adminAccount.address, burnAmount).estimateGas({ from: adminAccount.address })

            const txnBurn = {
                from: adminAccount.address,
                to: wAIPGContract.options.address,
                data: wAIPGContract.methods.burn(adminAccount.address, burnAmount).encodeABI(),
                gas: gasEstimate,
                gasPrice: gasPrice,
                nonce: nonce,
                chainId: chainId,
                value: '0x0'
            };

            const signedTx = await web3.eth.accounts.signTransaction(txnBurn, adminPrivateKey);
            await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

            const wAIPGAmountString = wAIPGAmount.toString();
            socket.emit('output', `${wAIPGAmountString} wAIPG was burned successfully!`);

            // Ravencoin transaction to send AIPG back to the user
            const aipgAmount = wAIPGAmount;
            const aipgAmountFee = aipgAmount.multipliedBy(new BigNumber(95).dividedBy(100));
            rpcparams = [userAIPGHoldingAddress, userAIPGReceivingAddress, aipgAmountFee];
            socket.emit('output', `rpcparams: ${rpcparams}`);
            const releaseCoins = rpc(methods.sendfromaddress, rpcparams); // Assuming Ravencoin RPC accepts amounts as strings
            releaseCoins.catch((e) => {
                socket.emit('output', `Error releasing AIPG to user: ${e.message}.`);
                return; // Exit the function if no address was retrieved
            });

            releaseCoins.then((response) => {
                 socket.emit('output', `${aipgAmountFee} AIPG Released from: ${userAIPGHoldingAddress} to: ${userAIPGReceivingAddress}! (5% Burn Fee extracted)`);
            });
        } else {
            socket.emit('output', "Failed to verify the transfer. Please check the transaction hash and try again.");
        }
    } catch (error) {
        console.error(`An error occurred: ${error}`);
        socket.emit('output', `An error occurred: ${error.message}`);
    }
}

module.exports = { handleAIPGUnwrap };
