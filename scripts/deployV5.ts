const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Deploying PatriotPledgeNFTV5 (Edition-based)...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "BDAG");

  console.log("Deploying contract...");
  
  // Get current gas price and add buffer
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
  console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  
  const adjustedGasPrice = gasPrice * 3n;
  console.log("Using gas price:", ethers.formatUnits(adjustedGasPrice, "gwei"), "gwei");

  const PatriotPledgeNFTV5 = await ethers.getContractFactory("PatriotPledgeNFTV5");
  const contract = await PatriotPledgeNFTV5.deploy({
    gasPrice: adjustedGasPrice
  });

  console.log("Transaction sent, waiting for confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PatriotPledgeNFTV5 deployed to:", address);

  console.log("\n=== IMPORTANT: Update your .env.local ===");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  
  console.log("\n=== Contract Features ===");
  console.log("- Edition-based NFTs (mint to donors)");
  console.log("- Living NFT metadata updates");
  console.log("- Direct BDAG purchases");
  console.log("- Campaign management");

  console.log("\nDeployment successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
