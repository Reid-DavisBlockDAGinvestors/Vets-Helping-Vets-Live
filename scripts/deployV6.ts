const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  console.log("Deploying PatriotPledgeNFTV6 (with batch minting + URI fix)...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "BDAG");

  console.log("Deploying contract...");
  
  // Get nonce - use pending to handle any pending transactions
  const nonce = await ethers.provider.getTransactionCount(deployer.address, "pending");
  console.log("Using nonce:", nonce);
  
  // Get current gas price and add buffer
  const feeData = await ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
  console.log("Gas price:", ethers.formatUnits(gasPrice, "gwei"), "gwei");
  
  const adjustedGasPrice = gasPrice * 3n;
  console.log("Using gas price:", ethers.formatUnits(adjustedGasPrice, "gwei"), "gwei");

  const PatriotPledgeNFTV6 = await ethers.getContractFactory("PatriotPledgeNFTV6");
  const contract = await PatriotPledgeNFTV6.deploy({
    nonce: nonce,
    gasLimit: 8000000n,
    gasPrice: adjustedGasPrice
  });

  console.log("Transaction sent, waiting for confirmation...");
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("PatriotPledgeNFTV6 deployed to:", address);

  console.log("\n=== IMPORTANT: Update your .env.local ===");
  console.log(`CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  
  console.log("\n=== V6 New Features ===");
  console.log("- setTokenURI() - Fix individual token URIs");
  console.log("- batchSetTokenURI() - Batch fix token URIs");
  console.log("- mintBatchWithBDAG() - Mint multiple NFTs in one tx");
  console.log("- mintBatchWithBDAGAndTip() - Batch mint with tips");
  console.log("- fixTokenCampaignLink() - Repair campaign-token links");

  console.log("\nDeployment successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
