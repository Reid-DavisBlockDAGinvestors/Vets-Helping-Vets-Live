import hardhat from "hardhat";
const { ethers } = hardhat as any;

async function main() {
  const [deployer] = await ethers.getSigners();
  const nonprofit = process.env.NONPROFIT_ADDRESS || deployer.address;
  const feeBps = process.env.FEE_BPS ? parseInt(process.env.FEE_BPS, 10) : 100; // default 1%

  console.log("Deployer:", deployer.address);
  console.log("Nonprofit:", nonprofit);
  console.log("FeeBps:", feeBps);

  const PatriotPledgeNFT = await ethers.getContractFactory("PatriotPledgeNFT");
  const contract = await PatriotPledgeNFT.deploy(nonprofit, feeBps);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  console.log("PatriotPledgeNFT deployed at:", addr);

  // Demo: mint, update, and release Wave 2 milestone
  const mintTx = await contract.mint(deployer.address, "ipfs://example-json", "general");
  const mintRcpt = await mintTx.wait();
  let tokenId: bigint | undefined;
  for (const log of mintRcpt?.logs ?? []) {
    try {
      const parsed = (contract as any).interface.parseLog(log);
      if (parsed?.name === "Minted") {
        tokenId = parsed.args?.tokenId as bigint;
        break;
      }
    } catch (_) {
      // skip non-matching logs
    }
  }
  if (tokenId === undefined) {
    throw new Error("Failed to parse Minted event to determine tokenId");
  }
  console.log("Minted tokenId:", tokenId.toString(), "tx:", mintRcpt?.hash);

  // Allow deployer as oracle for demo purposes
  const oracleTx = await contract.setOracle(deployer.address, true);
  await oracleTx.wait();
  console.log("Oracle enabled for:", deployer.address);

  const updateTx = await contract.updateTokenURI(tokenId, "ipfs://example-json-updated");
  await updateTx.wait();
  console.log("Updated token URI for:", tokenId.toString());

  // Wave 2 milestone (example milestone index 2)
  const wave = 2;
  const milestoneTx = await contract.oracleReleaseMilestone(tokenId, wave);
  const milestoneRcpt = await milestoneTx.wait();
  console.log("Wave", wave, "milestone released. tx:", milestoneRcpt?.hash);

  console.log("Set CONTRACT_ADDRESS=", addr, "in your env to use on the app side.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
