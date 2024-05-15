const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { handleWAIPGMint } = require('./scripts/Wrap.js');
const { handleAIPGUnwrap } = require('./scripts/Unwrap.js');

// Setup Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from 'public' directory
app.use(express.static('public'));

// Handle socket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('mint', async (data) => {
        // Data could contain the amount to mint or other parameters
        try {
          await handleWAIPGMint(socket, data);
        } catch (error) {
          console.error('Error handling mint:', error);
          socket.emit('output', { error: 'Error processing mint request.' });
        }
    });

    socket.on('unwrap', async (data) => {
        // Data could contain details necessary for unwrapping
        try {
          await handleAIPGUnwrap(socket, data);
        } catch (error) {
          console.error('Error handling unwrap:', error);
          socket.emit('output', { error: 'Error processing unwrap request.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3001, () => {
    console.log('Server is running on http://localhost:3001');
});
