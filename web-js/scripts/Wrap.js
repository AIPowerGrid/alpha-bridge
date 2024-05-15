require('dotenv').config();
const { Web3 } = require('web3');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const { getRPC, methods } = require("@ravenrebels/ravencoin-rpc");

// Function to handle wrapping
async function handleWAIPGMint(socket, data) {
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
    const passwd = process.env.APASS;
    const connect = "http://localhost:9788";
    const rpc = getRPC(user, passwd, connect);
    const aipgAmount = parseFloat(data.aipgAmount);
    try {
        params = [];
        const userAIPGAddress = rpc(methods.getnewaddress, params);

        userAIPGAddress.catch((e) => {
            socket.emit('output', `Error retrieving AIPG address: ${e}.`);
            return; // Exit the function if no address was retrieved
        });

        userAIPGAddress.then((response) => {
            socket.emit('output', `Please send ${aipgAmount} AIPG to this Aipowergrid address: ${response}`);
        });

        let transactionConfirmed = false;
        while (!transactionConfirmed) {
            //socket.emit('output', `The user may now begin the deposit of their AIPG to the designated wallet address...`);
            await new Promise(resolve => setTimeout(resolve, 50000)); // Properly await the timeout

            // socket.emit('output', `Waiting 10 more seconds for AIPG to be deposited...`);
            userDepositAddress = userAIPGAddress.result;
            userDepositAddressString = JSON.stringify(userDepositAddress, null, 0);
            newparams = [6, 20, userDepositAddressString];
            // Execute the RPC call and handle it correctly
            rpc(methods.listunspent, newparams)
                .then(response => {
                    if (response && response.length === 0) {
                        // If no transactions, emit a message and continue the loop
                        socket.emit('output', 'No fully confirmed transactions found yet, checking again in 60 seconds, this can take a little while, so get comfy...');
                        return; // Use return to wait for the next loop iteration
                    }

                    // Process each transaction to check for sufficient amount
                    let transactionsOutput = response.map(tx => `Transaction ID: ${tx.txid}, Amount: ${tx.amount}`).join('\n');
                    socket.emit('output', `Transactions: \n${transactionsOutput}`);

                    for (let tx of response) {
                        if (parseFloat(tx.amount) >= aipgAmount) {
                            transactionConfirmed = true;
                            socket.emit('output', "AIPG deposit confirmed.");
                            break; // Exit the loop since the condition is met
                        }
                    }
                    if (!transactionConfirmed) {
                        socket.emit('output', 'Your AIPG deposit has not been delivered to and/or verified on the specified address yet...');
                    }
                })
                .catch(e => {
                    console.error('Error in checking transactions:', e);
                    socket.emit('output', `Error in checking transactions: ${e.message}`);
                    return; // Optionally handle error such as retrying the loop or breaking out
                });

            // Await here to prevent the while loop from spinning without waiting for the promise
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait a bit before the next iteration
        }


        const userEthAddress = data.userEthAddress;
        if (!web3.utils.isAddress(userEthAddress)) {
            socket.emit('output', "\nUser account address is not set correctly.");
            return;
        }

        const nonce = await web3.eth.getTransactionCount(adminAccount.address);
        const mintAmount = new BigNumber(aipgAmount).multipliedBy(new BigNumber(10).pow(18));
        const mintAmountString = mintAmount.toString();
        const gasPrice = await web3.eth.getGasPrice();
        const chainId = await web3.eth.getChainId();
        const gasEstimateMint = await wAIPGContract.methods.mint(adminAccount.address, mintAmountString).estimateGas({ from: adminAccount.address })

        // Minting transaction
        const mintTx = {
            from: adminAccount.address,
            to: wAIPGContract.options.address,
            data: wAIPGContract.methods.mint(adminAccount.address, mintAmountString).encodeABI(),
            gas: gasEstimateMint,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: chainId,
            value: '0x0'
        };
        const mintTxString = JSON.stringify(mintTx, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()  // Convert BigInt to a string
                : value             // Leave other values unchanged
        , 2);
        socket.emit('output', `${mintTxString}`);

        const signedMintTx = await web3.eth.accounts.signTransaction(mintTx, adminPrivateKey);
        const mintTxReceipt = await web3.eth.sendSignedTransaction(signedMintTx.rawTransaction);

        // Check the transaction receipt to ensure it was successful
        if (!mintTxReceipt.status) {
            socket.emit('Mint transaction failed');
            return;
        }
        // After minting, get the new balance to confirm mint was successful
        //const balance = await wAIPGContract.methods.balanceOf(adminAccount.address).call();
        //const balanceInEther = await web3.utils.fromWei(balance, 'ether');
        socket.emit('output', `wAIPG issued to admin successfully!`);

        const transferAmount = mintAmount.multipliedBy(new BigNumber(95).dividedBy(100));
        const transferAmountString = transferAmount.toString();
        const transferAmountInEther = await web3.utils.fromWei(transferAmount, 'ether');
        //const gasEstimateTransfer = await wAIPGContract.methods.transfer(userEthAddress, transferAmountString).estimateGas({ from: adminAccount.address });
        //const gasPriceTransfer = await web3.eth.getGasPrice();
        //const chainIdTransfer = await web3.eth.getChainId();
        //const transferNonce = await web3.eth.getTransactionCount(adminAccount.address);
        socket.emit('output', `Sending wAIPG to address: ${userEthAddress}, ${transferAmountInEther} wAIPG (5% burn fee extracted)!`);


        // Transfer transaction
        //const transferTx = {
            //from: adminAccount.address,
            //to: userEthAddress,
            //data: wAIPGContract.methods.transfer(userEthAddress, transferAmountString).send({ from: adminAccount.address }).encodeABI(),
            //gas: gasEstimateTransfer,
            //gasPrice: gasPriceTransfer,
            //nonce: transferNonce,
            //chainId: chainIdTransfer,
            //value: '0x0'
        //};
        //console.log("Transaction object:", transferTx);
        //const transferTxString = JSON.stringify(transferTx, (key, value) =>
            //typeof value === 'bigint'
                //? value.toString()  // Convert BigInt to a string
                //: value             // Leave other values unchanged
        //, 2);
        //socket.emit('output', `${transferTxString}`);

        //const signedTransferTx = web3.eth.accounts.signTransaction(transferTx, adminPrivateKey);
        //await web3.eth.sendSignedTransaction(signedTransferTx.rawTransaction);
        await wAIPGContract.methods.transfer(userEthAddress, transferAmountString).send({ from: adminAccount.address });
        const userBalance = await wAIPGContract.methods.balanceOf(userEthAddress).call();
        const userBalanceInEther = await web3.utils.fromWei(userBalance, 'ether');
        socket.emit('output', `\nwAIPG issued to admin and transferred to user address: ${userEthAddress}, successfully! User Balance: ${userBalance} wAIPG (in wei)! User Balance: ${userBalanceInEther} wAIPG (in ether)!`);
        // socket.emit('output', `\nwAIPG transferred to user address: ${userEthAddress}, successfully!`);
    } catch (error) {
        console.error("Error in handleWAIPGMint:", error);
        socket.emit('output', `\nError: ${error.message}`);
    }
}


module.exports = { handleWAIPGMint };
