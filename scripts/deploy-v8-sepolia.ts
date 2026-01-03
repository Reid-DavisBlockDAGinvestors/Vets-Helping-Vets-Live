/**
 * Deploy PatriotPledgeNFTV8 to Sepolia Testnet
 * 
 * Usage:
 * npx hardhat run scripts/deploy-v8-sepolia.ts --network sepolia
 * 
 * Prerequisites:
 * - SEPOLIA_PRIVATE_KEY in .env
 * - SEPOLIA_RPC_URL in .env (or use default Infura/Alchemy)
 * - Sepolia ETH for gas (get from faucet)
 */

const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  console.log("🚀 Deploying PatriotPledgeNFTV8 to Sepolia...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(balance), "ETH\n");

  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance! Need at least 0.01 ETH for deployment.");
    console.log("   Get Sepolia ETH from: https://www.alchemy.com/faucets/ethereum-sepolia");
    process.exit(1);
  }

  // Constructor parameters
  const platformTreasury = deployer.address; // Use deployer as treasury for now
  const platformFeeBps = 100; // 1% platform fee

  console.log("📋 Constructor Parameters:");
  console.log("   - Platform Treasury:", platformTreasury);
  console.log("   - Platform Fee:", platformFeeBps, "bps (1%)\n");

  // Deploy contract
  console.log("⏳ Deploying contract...");
  const V8Factory = await ethers.getContractFactory("PatriotPledgeNFTV8");
  const v8 = await V8Factory.deploy(platformTreasury, platformFeeBps);
  
  await v8.waitForDeployment();
  const contractAddress = await v8.getAddress();

  console.log("\n✅ PatriotPledgeNFTV8 deployed!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔗 Etherscan: https://sepolia.etherscan.io/address/" + contractAddress);
  
  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const version = await v8.VERSION();
  const chainId = await v8.deploymentChainId();
  const treasury = await v8.platformTreasury();
  const fee = await v8.platformFeeBps();

  console.log("   - VERSION:", version.toString());
  console.log("   - deploymentChainId:", chainId.toString());
  console.log("   - platformTreasury:", treasury);
  console.log("   - platformFeeBps:", fee.toString());

  // Output for .env update
  console.log("\n" + "=".repeat(60));
  console.log("📝 Add to .env.local:");
  console.log("=".repeat(60));
  console.log(`CONTRACT_ADDRESS_V8=${contractAddress}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS_V8=${contractAddress}`);
  console.log("=".repeat(60));

  // Verify on Etherscan (optional)
  console.log("\n📜 To verify on Etherscan, run:");
  console.log(`npx hardhat verify --network sepolia ${contractAddress} "${platformTreasury}" ${platformFeeBps}`);

  return contractAddress;
}

main()
  .then((address) => {
    console.log("\n🎉 Deployment complete! Address:", address);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
