require('dotenv').config({ path: '.env.local' });
require("@nomicfoundation/hardhat-toolbox");

// Secure key retrieval - never log keys
const getPrivateKey = (envVar: string): string | undefined => {
  const key = process.env[envVar];
  if (!key) return undefined;
  // Ensure key has 0x prefix
  return key.startsWith('0x') ? key : `0x${key}`;
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    // BlockDAG Mainnet (Current Production)
    blockdag: {
      url: process.env.BLOCKDAG_RPC || "https://rpc.awakening.bdagscan.com",
      accounts: getPrivateKey('BDAG_RELAYER_KEY') ? [getPrivateKey('BDAG_RELAYER_KEY')] : [],
      chainId: 1043,
      httpHeaders: process.env.NOWNODES_API_KEY ? { 'api-key': process.env.NOWNODES_API_KEY } : {}
    },
    
    // Ethereum Sepolia Testnet (For V7 Testing)
    sepolia: {
      url: process.env.ETHEREUM_SEPOLIA_RPC || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
      accounts: getPrivateKey('ETH_DEPLOYER_KEY') ? [getPrivateKey('ETH_DEPLOYER_KEY')] : [],
      chainId: 11155111,
      gasPrice: 'auto',
      // Security: Set gas limits to prevent runaway transactions
      gas: 5000000,
    },
    
    // Ethereum Mainnet (Production - V8)
    ethereum: {
      url: process.env.ETHEREUM_RPC || `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || ''}`,
      accounts: getPrivateKey('ETH_DEPLOYER_KEY') ? [getPrivateKey('ETH_DEPLOYER_KEY')] : [],
      chainId: 1,
      gasPrice: 'auto',
      // V8 contract requires ~4.5M gas for deployment
      gas: 6000000,
    },
    
    // Polygon Mainnet (Future)
    polygon: {
      url: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
      accounts: getPrivateKey('ETH_DEPLOYER_KEY') ? [getPrivateKey('ETH_DEPLOYER_KEY')] : [],
      chainId: 137,
      gasPrice: 'auto',
    },
    
    // Base Mainnet (Future - Coinbase L2)
    base: {
      url: process.env.BASE_RPC || 'https://mainnet.base.org',
      accounts: getPrivateKey('ETH_DEPLOYER_KEY') ? [getPrivateKey('ETH_DEPLOYER_KEY')] : [],
      chainId: 8453,
      gasPrice: 'auto',
    }
  },
  
  // Etherscan verification
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || '',
      sepolia: process.env.ETHERSCAN_API_KEY || '',
      polygon: process.env.POLYGONSCAN_API_KEY || '',
      base: process.env.BASESCAN_API_KEY || '',
    }
  },
  
  // Gas reporter for cost estimation
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  }
};