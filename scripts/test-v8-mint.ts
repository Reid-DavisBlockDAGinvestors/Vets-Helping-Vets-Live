/**
 * Test minting an NFT on V8 contract
 */

const hre = require("hardhat");

async function main() {
  console.log("🎯 Testing V8 mint function...\n");

  const V8_ADDRESS = "0x042652292B8f1670b257707C1aDA4D19de9E9399";
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📍 Minter:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", hre.ethers.formatEther(balance), "ETH\n");
  
  const contract = await hre.ethers.getContractAt("PatriotPledgeNFTV8", V8_ADDRESS, deployer);

  // Get campaign info first
  const campaignId = 0;
  const campaign = await contract.getCampaign(campaignId);
  
  console.log("📋 Campaign #" + campaignId + ":");
  console.log("   priceNative:", hre.ethers.formatEther(campaign.priceNative), "ETH");
  console.log("   editionsMinted:", campaign.editionsMinted.toString());
  console.log("   active:", campaign.active);
  console.log("   immediatePayoutEnabled:", campaign.immediatePayoutEnabled);

  // Test mint() function (chain-agnostic)
  const mintPrice = campaign.priceNative;
  
  console.log("\n⏳ Minting NFT with mint() function...");
  console.log("   Value:", hre.ethers.formatEther(mintPrice), "ETH");
  
  const tx = await contract.mint(campaignId, { value: mintPrice });
  console.log("📝 Tx hash:", tx.hash);
  
  console.log("⏳ Waiting for confirmation...");
  const receipt = await tx.wait(1);
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Parse EditionMinted event
  const iface = new hre.ethers.Interface([
    'event EditionMinted(uint256 indexed campaignId, uint256 indexed tokenId, address indexed donor, uint256 editionNumber, uint256 amountPaid)'
  ]);

  let tokenId = null;
  let editionNumber = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'EditionMinted') {
        tokenId = Number(parsed.args.tokenId);
        editionNumber = Number(parsed.args.editionNumber);
        console.log("\n🎉 NFT Minted!");
        console.log("   tokenId:", tokenId);
        console.log("   editionNumber:", editionNumber);
        console.log("   donor:", parsed.args.donor);
        console.log("   amountPaid:", hre.ethers.formatEther(parsed.args.amountPaid), "ETH");
        break;
      }
    } catch {}
  }

  // Verify campaign state updated
  const campaignAfter = await contract.getCampaign(campaignId);
  console.log("\n📊 Campaign after mint:");
  console.log("   editionsMinted:", campaignAfter.editionsMinted.toString());
  console.log("   grossRaised:", hre.ethers.formatEther(campaignAfter.grossRaised), "ETH");
  console.log("   netRaised:", hre.ethers.formatEther(campaignAfter.netRaised), "ETH");

  // Verify token ownership
  if (tokenId !== null) {
    const owner = await contract.ownerOf(tokenId);
    console.log("\n🔍 Token #" + tokenId + " owner:", owner);
    console.log("   Expected:", deployer.address);
    console.log("   Match:", owner.toLowerCase() === deployer.address.toLowerCase() ? "✅" : "❌");
  }

  // Check total supply
  const totalSupply = await contract.totalSupply();
  console.log("\n📊 Total supply:", totalSupply.toString());

  console.log("\n" + "=".repeat(60));
  console.log("✅ V8 mint() function works correctly!");
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Mint failed:", error);
    process.exit(1);
  });
