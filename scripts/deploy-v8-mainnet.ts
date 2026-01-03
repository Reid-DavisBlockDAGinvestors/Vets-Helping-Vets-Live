/**
 * Deploy PatriotPledgeNFTV8 to Ethereum Mainnet
 * 
 * Usage:
 * npx hardhat run scripts/deploy-v8-mainnet.ts --network ethereum
 */

const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  console.log("🚀 Deploying PatriotPledgeNFTV8 to Ethereum Mainnet...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");

  // Get current gas price
  const feeData = await ethers.provider.getFeeData();
  console.log("⛽ Gas price:", ethers.formatUnits(feeData.gasPrice, "gwei"), "gwei\n");

  // Constructor parameters for V8 (only 2 params)
  const platformTreasury = deployer.address; // Platform treasury
  const platformFeeBps = 100; // 1% platform fee

  console.log("📋 Constructor Parameters:");
  console.log("   platformTreasury:", platformTreasury);
  console.log("   platformFeeBps:", platformFeeBps, "(1%)");
  console.log("");

  // Deploy with explicit gas limit
  console.log("⏳ Deploying contract...");
  const PatriotPledgeNFTV8 = await ethers.getContractFactory("PatriotPledgeNFTV8");
  const contract = await PatriotPledgeNFTV8.deploy(
    platformTreasury,
    platformFeeBps,
    { gasLimit: 6000000 }
  );

  console.log("📝 Tx hash:", contract.deploymentTransaction().hash);
  console.log("⏳ Waiting for confirmation...");
  
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ PatriotPledgeNFTV8 deployed to Ethereum Mainnet!");
  console.log("   Address:", address);
  console.log("   Tx:", contract.deploymentTransaction().hash);
  console.log("   Etherscan: https://etherscan.io/address/" + address);
  console.log("=".repeat(60));

  // Verify contract info
  console.log("\n📋 Verifying deployment...");
  const version = await contract.VERSION();
  const chainId = await contract.deploymentChainId();
  const treasury = await contract.platformTreasury();
  const paused = await contract.paused();
  
  console.log("   VERSION:", version.toString());
  console.log("   deploymentChainId:", chainId.toString());
  console.log("   platformTreasury:", treasury);
  console.log("   paused:", paused);

  console.log("\n📝 Add to .env.local:");
  console.log(`   CONTRACT_ADDRESS_V8_MAINNET=${address}`);
  console.log(`   NEXT_PUBLIC_CONTRACT_ADDRESS_V8_MAINNET=${address}`);

  console.log("\n📝 To verify on Etherscan:");
  console.log(`   npx hardhat verify --network ethereum ${address} ${platformTreasury} ${platformFeeBps}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
