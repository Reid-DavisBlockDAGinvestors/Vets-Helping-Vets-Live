/**
 * Create a test campaign on V8 contract for E2E testing
 */

const hre = require("hardhat");

async function main() {
  console.log("🚀 Creating test campaign on V8...\n");

  const V8_ADDRESS = "0x042652292B8f1670b257707C1aDA4D19de9E9399";
  const [deployer] = await hre.ethers.getSigners();
  
  console.log("📍 Deployer:", deployer.address);
  
  const contract = await hre.ethers.getContractAt("PatriotPledgeNFTV8", V8_ADDRESS, deployer);

  // Campaign parameters
  const category = "Veteran / Military";
  const baseURI = "https://gateway.pinata.cloud/ipfs/bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku"; // Sample IPFS URI
  const goalNative = hre.ethers.parseEther("0.01"); // 0.01 ETH goal (~$31)
  const goalUsd = 3100n; // $31.00 in cents
  const maxEditions = 100n;
  const priceNative = hre.ethers.parseEther("0.001"); // 0.001 ETH per NFT (~$3.10)
  const priceUsd = 310n; // $3.10 in cents
  const nonprofit = deployer.address; // Use deployer as nonprofit for testing
  const submitter = deployer.address; // Use deployer as submitter for testing
  const immediatePayoutEnabled = true;

  console.log("📋 Campaign Parameters:");
  console.log("   category:", category);
  console.log("   goalNative:", hre.ethers.formatEther(goalNative), "ETH");
  console.log("   goalUsd:", Number(goalUsd) / 100, "USD");
  console.log("   maxEditions:", maxEditions.toString());
  console.log("   priceNative:", hre.ethers.formatEther(priceNative), "ETH");
  console.log("   priceUsd:", Number(priceUsd) / 100, "USD");
  console.log("   nonprofit:", nonprofit);
  console.log("   submitter:", submitter);
  console.log("   immediatePayoutEnabled:", immediatePayoutEnabled);

  console.log("\n⏳ Submitting transaction...");
  
  const tx = await contract.createCampaign(
    category,
    baseURI,
    goalNative,
    goalUsd,
    maxEditions,
    priceNative,
    priceUsd,
    nonprofit,
    submitter,
    immediatePayoutEnabled
  );

  console.log("📝 Tx hash:", tx.hash);
  console.log("⏳ Waiting for confirmation...");
  
  const receipt = await tx.wait(1);
  console.log("✅ Confirmed in block:", receipt.blockNumber);

  // Parse CampaignCreated event
  const iface = new hre.ethers.Interface([
    'event CampaignCreated(uint256 indexed campaignId, address indexed nonprofit, address indexed submitter, string category, uint256 goalNative, uint256 goalUsd, uint256 maxEditions, uint256 priceNative, uint256 priceUsd, bool immediatePayoutEnabled)'
  ]);

  let campaignId = null;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics, data: log.data });
      if (parsed && parsed.name === 'CampaignCreated') {
        campaignId = Number(parsed.args.campaignId);
        console.log("\n🎉 Campaign created! ID:", campaignId);
        break;
      }
    } catch {}
  }

  // Verify campaign on-chain
  const totalCampaigns = await contract.totalCampaigns();
  console.log("\n📊 Total campaigns now:", totalCampaigns.toString());

  if (campaignId !== null) {
    const campaign = await contract.getCampaign(campaignId);
    console.log("\n📋 Campaign #" + campaignId + " on-chain data:");
    console.log("   id:", campaign.id.toString());
    console.log("   category:", campaign.category);
    console.log("   goalNative:", hre.ethers.formatEther(campaign.goalNative), "ETH");
    console.log("   goalUsd:", Number(campaign.goalUsd) / 100, "USD");
    console.log("   priceNative:", hre.ethers.formatEther(campaign.priceNative), "ETH");
    console.log("   priceUsd:", Number(campaign.priceUsd) / 100, "USD");
    console.log("   maxEditions:", campaign.maxEditions.toString());
    console.log("   active:", campaign.active);
    console.log("   paused:", campaign.paused);
    console.log("   closed:", campaign.closed);
    console.log("   immediatePayoutEnabled:", campaign.immediatePayoutEnabled);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test campaign created successfully!");
  console.log("   Campaign ID:", campaignId);
  console.log("   Contract:", V8_ADDRESS);
  console.log("   Tx:", tx.hash);
  console.log("=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
