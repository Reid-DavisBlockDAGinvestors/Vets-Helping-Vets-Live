/**
 * Test V8 getCampaign struct parsing - simulates frontend ABI usage
 */

const hre = require("hardhat");

// This is the V8_ABI getCampaign signature used in the frontend
const V8_GETCAMPAIGN_ABI = [
  'function getCampaign(uint256 campaignId) external view returns (tuple(uint256 id, string category, string baseURI, uint256 goalNative, uint256 goalUsd, uint256 grossRaised, uint256 netRaised, uint256 tipsReceived, uint256 editionsMinted, uint256 maxEditions, uint256 priceNative, uint256 priceUsd, address nonprofit, address submitter, bool active, bool paused, bool closed, bool refunded, bool immediatePayoutEnabled))',
  'function totalCampaigns() external view returns (uint256)',
];

async function main() {
  console.log("🔍 Testing V8 getCampaign struct parsing (frontend ABI)...\n");

  const V8_ADDRESS = "0x042652292B8f1670b257707C1aDA4D19de9E9399";
  
  // Use the frontend ABI (not the full contract)
  const contract = new hre.ethers.Contract(
    V8_ADDRESS,
    V8_GETCAMPAIGN_ABI,
    hre.ethers.provider
  );

  const totalCampaigns = await contract.totalCampaigns();
  console.log("📊 Total campaigns:", totalCampaigns.toString());

  if (totalCampaigns === 0n) {
    console.log("⚠️ No campaigns to test");
    return;
  }

  // Get campaign 0 using the struct-based ABI
  const campaign = await contract.getCampaign(0);

  console.log("\n📋 Campaign #0 parsed via V8_ABI:");
  console.log("   campaign.id:", campaign.id.toString());
  console.log("   campaign.category:", campaign.category);
  console.log("   campaign.baseURI:", campaign.baseURI.slice(0, 50) + "...");
  console.log("   campaign.goalNative:", hre.ethers.formatEther(campaign.goalNative), "ETH");
  console.log("   campaign.goalUsd:", Number(campaign.goalUsd) / 100, "USD");
  console.log("   campaign.grossRaised:", hre.ethers.formatEther(campaign.grossRaised), "ETH");
  console.log("   campaign.netRaised:", hre.ethers.formatEther(campaign.netRaised), "ETH");
  console.log("   campaign.tipsReceived:", hre.ethers.formatEther(campaign.tipsReceived), "ETH");
  console.log("   campaign.editionsMinted:", campaign.editionsMinted.toString());
  console.log("   campaign.maxEditions:", campaign.maxEditions.toString());
  console.log("   campaign.priceNative:", hre.ethers.formatEther(campaign.priceNative), "ETH");
  console.log("   campaign.priceUsd:", Number(campaign.priceUsd) / 100, "USD");
  console.log("   campaign.nonprofit:", campaign.nonprofit);
  console.log("   campaign.submitter:", campaign.submitter);
  console.log("   campaign.active:", campaign.active);
  console.log("   campaign.paused:", campaign.paused);
  console.log("   campaign.closed:", campaign.closed);
  console.log("   campaign.refunded:", campaign.refunded);
  console.log("   campaign.immediatePayoutEnabled:", campaign.immediatePayoutEnabled);

  // Verify all fields are accessible by name (struct parsing works)
  const checks = [
    { name: "id", value: campaign.id, expected: "bigint" },
    { name: "category", value: campaign.category, expected: "string" },
    { name: "active", value: campaign.active, expected: "boolean" },
    { name: "paused", value: campaign.paused, expected: "boolean" },
    { name: "closed", value: campaign.closed, expected: "boolean" },
    { name: "priceNative", value: campaign.priceNative, expected: "bigint" },
    { name: "priceUsd", value: campaign.priceUsd, expected: "bigint" },
  ];

  console.log("\n✅ Field type verification:");
  let allPass = true;
  for (const check of checks) {
    const actualType = typeof check.value;
    const pass = actualType === check.expected;
    console.log(`   ${check.name}: ${actualType} ${pass ? "✅" : "❌ (expected " + check.expected + ")"}`);
    if (!pass) allPass = false;
  }

  if (allPass) {
    console.log("\n" + "=".repeat(60));
    console.log("✅ V8 struct-based getCampaign works correctly!");
    console.log("   Frontend ABI parses all fields by name.");
    console.log("   No more index-based access needed.");
    console.log("=".repeat(60));
  } else {
    console.log("\n❌ Some fields failed type checks");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
