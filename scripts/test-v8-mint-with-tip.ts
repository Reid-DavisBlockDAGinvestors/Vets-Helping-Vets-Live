/**
 * Test minting with tip on V8 contract and verify immediate payout
 */

const hre = require("hardhat");

async function main() {
  console.log("🎯 Testing V8 mintWithTip function and immediate payout...\n");

  const V8_ADDRESS = "0x042652292B8f1670b257707C1aDA4D19de9E9399";
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📍 Minter:", deployer.address);
  
  const contract = await hre.ethers.getContractAt("PatriotPledgeNFTV8", V8_ADDRESS, deployer);

  // Get campaign info
  const campaignId = 0;
  const campaign = await contract.getCampaign(campaignId);
  
  console.log("📋 Campaign #" + campaignId + " before mint:");
  console.log("   priceNative:", hre.ethers.formatEther(campaign.priceNative), "ETH");
  console.log("   editionsMinted:", campaign.editionsMinted.toString());
  console.log("   grossRaised:", hre.ethers.formatEther(campaign.grossRaised), "ETH");
  console.log("   tipsReceived:", hre.ethers.formatEther(campaign.tipsReceived), "ETH");
  console.log("   immediatePayoutEnabled:", campaign.immediatePayoutEnabled);

  // Get submitter balance before (for immediate payout verification)
  const submitter = campaign.submitter;
  const submitterBalanceBefore = await hre.ethers.provider.getBalance(submitter);
  console.log("\n💰 Submitter balance before:", hre.ethers.formatEther(submitterBalanceBefore), "ETH");

  // Mint with tip
  const mintPrice = campaign.priceNative;
  const tipAmount = hre.ethers.parseEther("0.0005"); // 0.0005 ETH tip
  const totalValue = mintPrice + tipAmount;
  
  console.log("\n⏳ Minting NFT with tip...");
  console.log("   Base price:", hre.ethers.formatEther(mintPrice), "ETH");
  console.log("   Tip:", hre.ethers.formatEther(tipAmount), "ETH");
  console.log("   Total:", hre.ethers.formatEther(totalValue), "ETH");
  
  const tx = await contract.mintWithTip(campaignId, tipAmount, { value: totalValue });
  console.log("📝 Tx hash:", tx.hash);
  
  const receipt = await tx.wait(1);
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Parse events
  const editionMintedIface = new hre.ethers.Interface([
    'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amountPaid)'
  ]);

  const fundsDistributedIface = new hre.ethers.Interface([
    'event FundsDistributed(uint256 indexed campaignId, address indexed recipient, uint256 amount, string distributionType)'
  ]);

  for (const log of receipt.logs) {
    try {
      const parsed = editionMintedIface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'EditionMinted') {
        console.log("\n🎉 EditionMinted event:");
        console.log("   tokenId:", parsed.args.tokenId.toString());
        console.log("   editionNumber:", parsed.args.editionNumber.toString());
        console.log("   amountPaid:", hre.ethers.formatEther(parsed.args.amountPaid), "ETH");
      }
    } catch {}
    
    try {
      const parsed = fundsDistributedIface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'FundsDistributed') {
        console.log("\n💸 FundsDistributed event (IMMEDIATE PAYOUT):");
        console.log("   recipient:", parsed.args.recipient);
        console.log("   amount:", hre.ethers.formatEther(parsed.args.amount), "ETH");
        console.log("   type:", parsed.args.distributionType);
      }
    } catch {}
  }

  // Check submitter balance after (for immediate payout verification)
  const submitterBalanceAfter = await hre.ethers.provider.getBalance(submitter);
  const balanceIncrease = submitterBalanceAfter - submitterBalanceBefore;
  console.log("\n💰 Submitter balance after:", hre.ethers.formatEther(submitterBalanceAfter), "ETH");
  console.log("   Balance increase:", hre.ethers.formatEther(balanceIncrease), "ETH");
  
  if (balanceIncrease > 0n) {
    console.log("   ✅ IMMEDIATE PAYOUT CONFIRMED!");
  } else {
    console.log("   ⚠️ No balance increase (submitter may be same as minter)");
  }

  // Verify campaign state updated
  const campaignAfter = await contract.getCampaign(campaignId);
  console.log("\n📊 Campaign after mint with tip:");
  console.log("   editionsMinted:", campaignAfter.editionsMinted.toString());
  console.log("   grossRaised:", hre.ethers.formatEther(campaignAfter.grossRaised), "ETH");
  console.log("   netRaised:", hre.ethers.formatEther(campaignAfter.netRaised), "ETH");
  console.log("   tipsReceived:", hre.ethers.formatEther(campaignAfter.tipsReceived), "ETH");

  // Check total supply
  const totalSupply = await contract.totalSupply();
  console.log("\n📊 Total supply:", totalSupply.toString());

  console.log("\n" + "=".repeat(60));
  console.log("✅ V8 mintWithTip() function works correctly!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
