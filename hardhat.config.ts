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
      }
    }
  },
  networks: {
    blockdag: {
      url: process.env.BLOCKDAG_RELAYER_RPC || "https://relay.awakening.bdagscan.com",
      accounts: [process.env.BDAG_RELAYER_KEY],   // now it will see your key
      chainId: 2025
    }
  }
};