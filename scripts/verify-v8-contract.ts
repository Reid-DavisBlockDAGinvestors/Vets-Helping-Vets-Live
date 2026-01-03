/**
 * Verify PatriotPledgeNFTV8 contract is working on Sepolia
 */

const hre = require("hardhat");

async function main() {
  console.log("🔍 Verifying PatriotPledgeNFTV8 on Sepolia...\n");

  const V8_ADDRESS = "0x042652292B8f1670b257707C1aDA4D19de9E9399";
  
  const contract = await hre.ethers.getContractAt("PatriotPledgeNFTV8", V8_ADDRESS);

  console.log("📋 Contract Info:");
  console.log("   Address:", V8_ADDRESS);
  console.log("   VERSION:", (await contract.VERSION()).toString());
  console.log("   deploymentChainId:", (await contract.deploymentChainId()).toString());
  console.log("   totalCampaigns:", (await contract.totalCampaigns()).toString());
  console.log("   platformTreasury:", await contract.platformTreasury());
  console.log("   platformFeeBps:", (await contract.platformFeeBps()).toString(), "bps");
  console.log("   paused:", await contract.paused());
  console.log("   totalSupply:", (await contract.totalSupply()).toString());

  console.log("\n✅ V8 Contract is functional!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
