/**
 * Check deployer wallet balance on Ethereum Mainnet
 */

const hre = require("hardhat");

async function main() {
  console.log("💰 Checking Ethereum Mainnet balance...\n");

  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📍 Deployer:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  const balanceEth = hre.ethers.formatEther(balance);
  
  console.log("💰 Balance:", balanceEth, "ETH");
  
  // Estimate deployment cost at current gas price
  const feeData = await hre.ethers.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  
  console.log("\n⛽ Current Gas Prices:");
  console.log("   gasPrice:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");
  
  // Estimated gas for V8 deployment (~4.5M gas)
  const estimatedGas = 4500000n;
  const estimatedCost = estimatedGas * gasPrice;
  
  console.log("\n📊 Estimated Deployment Cost:");
  console.log("   Gas units:", estimatedGas.toString());
  console.log("   Estimated cost:", hre.ethers.formatEther(estimatedCost), "ETH");
  
  const sufficient = balance >= estimatedCost;
  console.log("\n" + (sufficient ? "✅ Sufficient balance for deployment" : "❌ Insufficient balance"));
  
  if (!sufficient) {
    const needed = estimatedCost - balance;
    console.log("   Need additional:", hre.ethers.formatEther(needed), "ETH");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
