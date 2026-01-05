'use strict';

const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

/**
 * FabricGateway - Manages connection to Hyperledger Fabric network
 */
class FabricGateway {
    constructor() {
        this.gateway = null;
        this.network = null;
        this.contract = null;
        this.connected = false;
    }

    /**
     * Connect to the Fabric network
     */
    async connect() {
        try {
            // Load connection profile
            const ccpPath = path.resolve(process.env.CONNECTION_PROFILE_PATH || '../connection-profile.json');

            if (!fs.existsSync(ccpPath)) {
                throw new Error(`Connection profile not found at: ${ccpPath}`);
            }

            const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

            // Load wallet
            const walletPath = path.resolve(process.env.WALLET_PATH || './wallet');
            const wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check for identity
            const identity = process.env.USER_IDENTITY || 'admin';
            const userIdentity = await wallet.get(identity);

            if (!userIdentity) {
                throw new Error(`Identity "${identity}" not found in wallet. Please enroll the user first.`);
            }

            // Create gateway connection
            this.gateway = new Gateway();
            await this.gateway.connect(ccp, {
                wallet,
                identity: identity,
                discovery: { enabled: true, asLocalhost: false }
            });

            // Get network and contract
            const channelName = process.env.CHANNEL_NAME || 'mychannel';
            const chaincodeName = process.env.CHAINCODE_NAME || 'asset-chaincode';

            this.network = await this.gateway.getNetwork(channelName);
            this.contract = this.network.getContract(chaincodeName);
            this.connected = true;

            console.log('✅ Connected to Fabric network');
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Fabric network:', error.message);
            this.connected = false;
            throw error;
        }
    }

    /**
     * Disconnect from the Fabric network
     */
    async disconnect() {
        if (this.gateway) {
            await this.gateway.disconnect();
            this.connected = false;
            console.log('Disconnected from Fabric network');
        }
    }

    /**
     * Get the contract instance
     */
    getContract() {
        if (!this.connected || !this.contract) {
            throw new Error('Not connected to Fabric network');
        }
        return this.contract;
    }

    /**
     * Submit a transaction (write operation)
     */
    async submitTransaction(functionName, ...args) {
        const contract = this.getContract();
        console.log(`Submitting transaction: ${functionName}(${args.join(', ')})`);
        const result = await contract.submitTransaction(functionName, ...args);
        return result.toString();
    }

    /**
     * Evaluate a transaction (read operation)
     */
    async evaluateTransaction(functionName, ...args) {
        const contract = this.getContract();
        console.log(`Evaluating transaction: ${functionName}(${args.join(', ')})`);
        const result = await contract.evaluateTransaction(functionName, ...args);
        return result.toString();
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }
}

// Singleton instance
const fabricGateway = new FabricGateway();

module.exports = fabricGateway;
