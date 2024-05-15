document.addEventListener('DOMContentLoaded', function() {
    const socket = io(); // Connect to Socket.IO server
    window.scrollTo(0, 0); // Scrolls to the top of the page when it loads

    // Function to send data to the server when the 'Wrap AIPG' button is clicked
    document.getElementById('mintButton').addEventListener('click', function() {
        const aipgAmount = document.getElementById('aipgAmount').value;
        const userEthAddress = document.getElementById('userEthAddressMint').value;

        // Emitting a 'mint' event with the user's input data
        socket.emit('mint', { aipgAmount, userEthAddress });
    });

    // Function to send data to the server when the 'Unwrap AIPG' button is clicked
    document.getElementById('burnButton').addEventListener('click', function() {
        const wAIPGAmount = document.getElementById('wAIPGAmount').value;
        const userEthAddress = document.getElementById('userEthAddressBurn').value;
        const userAIPGHoldingAddress = document.getElementById('userAIPGHoldingAddress').value;
        const userAIPGReceivingAddress = document.getElementById('userAIPGReceivingAddress').value;
        const userTxHash = document.getElementById('userTxHash').value;

        // Emitting a 'burn' event with the user's input data
        socket.emit('unwrap', { wAIPGAmount, userEthAddress, userAIPGHoldingAddress, userAIPGReceivingAddress, userTxHash });
    });

    // Function to send data to the server when the 'Wrap AIPG' button is click>
    document.getElementById('headerMintButton').addEventListener('click', function() {
        const headerDiv = document.getElementById('headerDiv');
        const primaryHeaderDiv = document.getElementById('primaryHeaderDiv');
        const mintDiv = document.getElementById('wrapDiv');
        headerDiv.style.display = "none";
        primaryHeaderDiv.style.display = "flex";
        mintDiv.style.display = "flex";
    });

    // Function to send data to the server when the 'Wrap AIPG' button is click>
    document.getElementById('headerBurnButton').addEventListener('click', function() {
        const headerDiv = document.getElementById('headerDiv');
        const primaryHeaderDiv = document.getElementById('primaryHeaderDiv');
        const burnDiv = document.getElementById('unwrapDiv');
        headerDiv.style.display = "none";
        primaryHeaderDiv.style.display = "flex";
        burnDiv.style.display = "flex";
    });

    // Listening for 'output' messages from the server to update the client UI
    socket.on('output', function(message) {
        const outputDiv = document.getElementById('output');
        outputDiv.style.display = "flex";
        outputDiv.innerHTML += `<p>${message}</p>`; // Append new messages to the output area
    });
});
