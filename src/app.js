'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fabricGateway = require('./fabric/gateway');
const assetsRouter = require('./routes/assets');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes
app.use('/api/assets', assetsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        fabricConnected: fabricGateway.isConnected(),
        timestamp: new Date().toISOString()
    });
});

// Connection status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        connected: fabricGateway.isConnected(),
        channel: process.env.CHANNEL_NAME || 'mychannel',
        chaincode: process.env.CHAINCODE_NAME || 'asset-chaincode'
    });
});

// Manual connect endpoint (for testing when Fabric is available)
app.post('/api/connect', async (req, res) => {
    try {
        await fabricGateway.connect();
        res.json({
            success: true,
            message: 'Connected to Fabric network'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Disconnect endpoint
app.post('/api/disconnect', async (req, res) => {
    try {
        await fabricGateway.disconnect();
        res.json({
            success: true,
            message: 'Disconnected from Fabric network'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, async () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Fabric Asset Management Server                        ║
║                                                            ║
║   Server running at: http://localhost:${PORT}                ║
║   API Base URL:      http://localhost:${PORT}/api            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);

    // Attempt to connect to Fabric on startup
    try {
        console.log('Attempting to connect to Fabric network...');
        await fabricGateway.connect();
    } catch (error) {
        console.warn('⚠️  Could not connect to Fabric network:', error.message);
        console.warn('⚠️  Please configure connection profile and wallet, then use POST /api/connect');
    }
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await fabricGateway.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await fabricGateway.disconnect();
    process.exit(0);
});
