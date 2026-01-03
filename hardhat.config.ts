require('dotenv').config({ path: '.env.local' });
require("@nomicfoundation/hardhat-toolbox");
// Foundry integration - uncomment after installing Foundry CLI
// Install: curl -L https://foundry.paradigm.xyz | bash && foundryup
// require("@nomicfoundation/hardhat-foundry");

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
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true,
      evmVersion: "cancun"
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
  
  // Etherscan verification (V2 API - unified key for all chains)
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || '',
  },
  
  // Sourcify verification (optional - decentralized)
  sourcify: {
    enabled: false,
  },
  
  // Gas reporter for cost estimation
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  }
};