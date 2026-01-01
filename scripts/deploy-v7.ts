/**
 * PatriotPledge V7 Contract Deployment Script
 * 
 * Industry-Grade Security Features:
 * - Pre-deployment validation
 * - Gas price limits to prevent overspending
 * - Confirmation prompts for mainnet
 * - Automatic contract verification
 * - Deployment logging for audit trail
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-v7.ts --network sepolia
 *   npx hardhat run scripts/deploy-v7.ts --network ethereum
 */

import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ Configuration ============

interface DeploymentConfig {
  treasuryWallet: string;
  platformFeeBps: number;
  maxGasPriceGwei: number;
  requireConfirmation: boolean;
}

const DEPLOYMENT_CONFIGS: Record<string, DeploymentConfig> = {
  sepolia: {
    treasuryWallet: process.env.TREASURY_WALLET || "0xbFD14c5A940E783AEc1993598143B59D3C971eF1",
    platformFeeBps: 100, // 1%
    maxGasPriceGwei: 50,
    requireConfirmation: false,
  },
  ethereum: {
    treasuryWallet: process.env.TREASURY_WALLET || "0xbFD14c5A940E783AEc1993598143B59D3C971eF1",
    platformFeeBps: 100, // 1%
    maxGasPriceGwei: parseInt(process.env.MAX_GAS_PRICE_GWEI || "100"),
    requireConfirmation: true, // ALWAYS confirm on mainnet
  },
  blockdag: {
    treasuryWallet: process.env.TREASURY_WALLET || "0xbFD14c5A940E783AEc1993598143B59D3C971eF1",
    platformFeeBps: 100,
    maxGasPriceGwei: 1000, // BDAG gas is cheap
    requireConfirmation: true,
  },
};

// ============ Utility Functions ============

function log(message: string, type: "info" | "warn" | "error" | "success" = "info") {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: "ℹ️ ",
    warn: "⚠️ ",
    error: "❌",
    success: "✅",
  }[type];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

function saveDeploymentLog(data: object, networkName: string) {
  const logDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `v7-${networkName}-${timestamp}.json`;
  const filepath = path.join(logDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  log(`Deployment log saved to: ${filepath}`, "success");
  
  // Also update latest deployment file
  const latestPath = path.join(logDir, `v7-${networkName}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
}

// ============ Pre-Deployment Checks ============

async function runPreDeploymentChecks(config: DeploymentConfig): Promise<boolean> {
  log("Running pre-deployment security checks...", "info");
  
  // 1. Validate treasury address
  if (!ethers.isAddress(config.treasuryWallet)) {
    log(`Invalid treasury wallet address: ${config.treasuryWallet}`, "error");
    return false;
  }
  log(`Treasury wallet: ${config.treasuryWallet}`, "info");
  
  // 2. Validate fee configuration
  if (config.platformFeeBps > 3000) {
    log(`Platform fee too high: ${config.platformFeeBps / 100}% (max 30%)`, "error");
    return false;
  }
  log(`Platform fee: ${config.platformFeeBps / 100}%`, "info");
  
  // 3. Check deployer balance
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);
  log(`Deployer address: ${deployer.address}`, "info");
  log(`Deployer balance: ${balanceEth} ETH`, "info");
  
  if (balance < ethers.parseEther("0.01")) {
    log("Deployer balance too low for deployment", "error");
    return false;
  }
  
  // 4. Check current gas price
  const feeData = await ethers.provider.getFeeData();
  const gasPriceGwei = feeData.gasPrice ? Number(ethers.formatUnits(feeData.gasPrice, "gwei")) : 0;
  log(`Current gas price: ${gasPriceGwei.toFixed(2)} gwei`, "info");
  
  if (gasPriceGwei > config.maxGasPriceGwei) {
    log(`Gas price ${gasPriceGwei} gwei exceeds limit ${config.maxGasPriceGwei} gwei`, "error");
    log("Wait for lower gas prices or increase MAX_GAS_PRICE_GWEI", "warn");
    return false;
  }
  
  // 5. Estimate deployment cost
  const estimatedGas = 5_000_000; // Conservative estimate
  const estimatedCost = feeData.gasPrice ? feeData.gasPrice * BigInt(estimatedGas) : BigInt(0);
  const estimatedCostEth = ethers.formatEther(estimatedCost);
  log(`Estimated deployment cost: ~${estimatedCostEth} ETH`, "info");
  
  log("All pre-deployment checks passed!", "success");
  return true;
}

// ============ Main Deployment Function ============

async function main() {
  const networkName = network.name;
  log(`Starting V7 deployment to ${networkName}...`, "info");
  
  // Get configuration
  const config = DEPLOYMENT_CONFIGS[networkName];
  if (!config) {
    log(`No deployment config for network: ${networkName}`, "error");
    log(`Supported networks: ${Object.keys(DEPLOYMENT_CONFIGS).join(", ")}`, "info");
    process.exit(1);
  }
  
  // Run pre-deployment checks
  const checksPass = await runPreDeploymentChecks(config);
  if (!checksPass) {
    log("Pre-deployment checks failed. Aborting.", "error");
    process.exit(1);
  }
  
  // Confirmation for mainnet
  if (config.requireConfirmation) {
    console.log("\n" + "=".repeat(60));
    console.log("⚠️  MAINNET DEPLOYMENT WARNING");
    console.log("=".repeat(60));
    console.log(`Network: ${networkName}`);
    console.log(`Treasury: ${config.treasuryWallet}`);
    console.log(`Platform Fee: ${config.platformFeeBps / 100}%`);
    console.log("=".repeat(60) + "\n");
    
    const confirmed = await promptConfirmation("Are you sure you want to deploy to MAINNET?");
    if (!confirmed) {
      log("Deployment cancelled by user", "warn");
      process.exit(0);
    }
  }
  
  // Deploy contract
  log("Deploying PatriotPledgeNFTV7...", "info");
  const startTime = Date.now();
  
  const PatriotPledgeNFTV7 = await ethers.getContractFactory("PatriotPledgeNFTV7");
  const contract = await PatriotPledgeNFTV7.deploy(
    config.treasuryWallet,
    config.platformFeeBps
  );
  
  log("Waiting for deployment confirmation...", "info");
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  const deploymentTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  log(`Contract deployed to: ${contractAddress}`, "success");
  log(`Deployment time: ${deploymentTime}s`, "info");
  
  // Get deployment transaction details
  const deployTx = contract.deploymentTransaction();
  const receipt = await deployTx?.wait();
  
  // Prepare deployment log
  const deploymentLog = {
    contract: "PatriotPledgeNFTV7",
    version: "7.0.0",
    network: networkName,
    chainId: network.config.chainId,
    address: contractAddress,
    deployer: (await ethers.getSigners())[0].address,
    treasury: config.treasuryWallet,
    platformFeeBps: config.platformFeeBps,
    transactionHash: deployTx?.hash,
    blockNumber: receipt?.blockNumber,
    gasUsed: receipt?.gasUsed?.toString(),
    deployedAt: new Date().toISOString(),
  };
  
  // Save deployment log
  saveDeploymentLog(deploymentLog, networkName);
  
  // Verify contract on Etherscan (if not local)
  if (networkName !== "hardhat" && networkName !== "localhost") {
    log("Waiting 30 seconds before verification...", "info");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      log("Verifying contract on Etherscan...", "info");
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: [config.treasuryWallet, config.platformFeeBps],
      });
      log("Contract verified on Etherscan!", "success");
    } catch (error: any) {
      if (error.message.includes("Already Verified")) {
        log("Contract already verified", "info");
      } else {
        log(`Verification failed: ${error.message}`, "warn");
        log("You can verify manually later", "info");
      }
    }
  }
  
  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL");
  console.log("=".repeat(60));
  console.log(`Contract: PatriotPledgeNFTV7`);
  console.log(`Address:  ${contractAddress}`);
  console.log(`Network:  ${networkName}`);
  console.log(`Chain ID: ${network.config.chainId}`);
  console.log(`Treasury: ${config.treasuryWallet}`);
  console.log(`Fee:      ${config.platformFeeBps / 100}%`);
  console.log("=".repeat(60));
  console.log("\n📋 Next Steps:");
  console.log(`1. Add to .env.local: V7_CONTRACT_${networkName.toUpperCase()}=${contractAddress}`);
  console.log(`2. Update lib/chains.ts with the contract address`);
  console.log(`3. Test all contract functions`);
  console.log(`4. Run E2E tests on ${networkName}`);
  if (networkName === "sepolia") {
    console.log(`5. After testing, deploy to ethereum mainnet`);
  }
  console.log("=".repeat(60) + "\n");
  
  return contractAddress;
}

// Execute
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
