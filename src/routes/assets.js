'use strict';

const express = require('express');
const router = express.Router();
const fabricGateway = require('../fabric/gateway');

/**
 * Middleware to check Fabric connection
 */
const checkConnection = (req, res, next) => {
    if (!fabricGateway.isConnected()) {
        return res.status(503).json({
            success: false,
            error: 'Not connected to Fabric network. Please configure and connect first.'
        });
    }
    next();
};

/**
 * POST /api/assets/init
 * Initialize the ledger with sample assets
 */
router.post('/init', checkConnection, async (req, res) => {
    try {
        const result = await fabricGateway.submitTransaction('InitLedger');
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('InitLedger error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/assets
 * Get all assets from the ledger
 */
router.get('/', checkConnection, async (req, res) => {
    try {
        const result = await fabricGateway.evaluateTransaction('GetAllAssets');
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('GetAllAssets error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/assets/owner/:owner
 * Query assets by owner
 */
router.get('/owner/:owner', checkConnection, async (req, res) => {
    try {
        const { owner } = req.params;
        const result = await fabricGateway.evaluateTransaction('QueryAssetsByOwner', owner);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('QueryAssetsByOwner error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/assets/:id
 * Read a specific asset
 */
router.get('/:id', checkConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await fabricGateway.evaluateTransaction('ReadAsset', id);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('ReadAsset error:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/assets/:id/history
 * Get asset history
 */
router.get('/:id/history', checkConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await fabricGateway.evaluateTransaction('GetAssetHistory', id);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('GetAssetHistory error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/assets
 * Create a new asset
 */
router.post('/', checkConnection, async (req, res) => {
    try {
        const { id, color, owner } = req.body;

        if (!id || !color || !owner) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, color, owner'
            });
        }

        const result = await fabricGateway.submitTransaction('CreateAsset', id, color, owner);
        res.status(201).json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('CreateAsset error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/assets/:id
 * Update an existing asset
 */
router.put('/:id', checkConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { color, owner } = req.body;

        if (!color || !owner) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: color, owner'
            });
        }

        const result = await fabricGateway.submitTransaction('UpdateAsset', id, color, owner);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('UpdateAsset error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/assets/:id
 * Delete an asset
 */
router.delete('/:id', checkConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await fabricGateway.submitTransaction('DeleteAsset', id);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('DeleteAsset error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/assets/:id/transfer
 * Transfer asset ownership
 */
router.post('/:id/transfer', checkConnection, async (req, res) => {
    try {
        const { id } = req.params;
        const { newOwner } = req.body;

        if (!newOwner) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: newOwner'
            });
        }

        const result = await fabricGateway.submitTransaction('TransferAsset', id, newOwner);
        res.json({
            success: true,
            data: JSON.parse(result)
        });
    } catch (error) {
        console.error('TransferAsset error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
