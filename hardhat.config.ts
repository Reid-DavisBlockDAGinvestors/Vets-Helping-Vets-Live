require('dotenv').config({ path: '.env.local' });   // ← this loads your existing .env.local
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true  // Enable IR-based compilation to handle stack depth
    }
  },
  networks: {
    blockdag: {
      url: process.env.BLOCKDAG_RPC || process.env.BLOCKDAG_RELAYER_RPC || "https://rpc.awakening.bdagscan.com",
      accounts: [process.env.BDAG_RELAYER_KEY],
      chainId: 1043,
      // NowNodes requires API key in headers
      httpHeaders: process.env.NOWNODES_API_KEY ? { 'api-key': process.env.NOWNODES_API_KEY } : {}
    }
  }
};