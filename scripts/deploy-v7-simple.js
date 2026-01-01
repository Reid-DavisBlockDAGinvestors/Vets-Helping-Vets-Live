/**
 * PatriotPledge V7 Contract Deployment Script (Simple)
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-v7-simple.js --network sepolia
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log("=".repeat(60));
  console.log(`Deploying PatriotPledgeNFTV7 to ${networkName}...`);
  console.log("=".repeat(60));

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Check balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  if (balance < hre.ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance for deployment");
    process.exit(1);
  }

  // Treasury wallet from env
  const treasuryWallet = process.env.TREASURY_WALLET || "0xbFD14c5A940E783AEc1993598143B59D3C971eF1";
  const platformFeeBps = 100; // 1%

  console.log("Treasury:", treasuryWallet);
  console.log("Platform Fee:", platformFeeBps / 100, "%");
  console.log("");

  // Deploy
  console.log("Deploying contract...");
  const PatriotPledgeNFTV7 = await hre.ethers.getContractFactory("PatriotPledgeNFTV7");
  const contract = await PatriotPledgeNFTV7.deploy(treasuryWallet, platformFeeBps);

  console.log("Waiting for deployment...");
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();

  console.log("");
  console.log("=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("Contract Address:", contractAddress);
  console.log("Transaction Hash:", deployTx?.hash);
  console.log("Network:", networkName);
  console.log("Chain ID:", hre.network.config.chainId);
  console.log("=".repeat(60));

  // Save deployment info
  const deploymentDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }

  const deploymentInfo = {
    contract: "PatriotPledgeNFTV7",
    address: contractAddress,
    network: networkName,
    chainId: hre.network.config.chainId,
    treasury: treasuryWallet,
    platformFeeBps: platformFeeBps,
    deployer: deployer.address,
    txHash: deployTx?.hash,
    deployedAt: new Date().toISOString()
  };

  const filename = `v7-${networkName}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  fs.writeFileSync(
    path.join(deploymentDir, `v7-${networkName}-latest.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("");
  console.log("📋 Next Steps:");
  console.log(`1. Add to .env.local:`);
  console.log(`   V7_CONTRACT_${networkName.toUpperCase()}=${contractAddress}`);
  console.log(`   NEXT_PUBLIC_V7_CONTRACT_${networkName.toUpperCase()}=${contractAddress}`);
  console.log(`2. Verify contract on Etherscan (optional):`);
  console.log(`   npx hardhat verify --network ${networkName} ${contractAddress} "${treasuryWallet}" ${platformFeeBps}`);
  console.log("=".repeat(60));

  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
