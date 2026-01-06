require('dotenv').config({ path: '.env.local' });
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/' + process.env.NEXT_PUBLIC_ALCHEMY_API_KEY);

const abi = [
  'function getCampaign(uint256) view returns (tuple(address creator, uint256 pricePerEdition, uint256 editionsMinted, uint256 maxEditions, uint256 grossRaised, bool exists, bool paused, uint256 usdPrice, string metadataUri))',
  'function totalCampaigns() view returns (uint256)',
  'function totalSupply() view returns (uint256)'
];

const contract = new ethers.Contract('0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e', abi, provider);
const ETH_USD = 3100;

async function audit() {
  console.log('=== ETHEREUM MAINNET ON-CHAIN GROUND TRUTH ===');
  console.log('Contract: 0xd6aEE73e3bB3c3fF149eB1198bc2069d2E37eB7e');
  console.log('ETH/USD Rate: $' + ETH_USD);
  console.log('');
  
  const totalCampaigns = await contract.totalCampaigns();
  const totalSupply = await contract.totalSupply();
  
  console.log('Total Campaigns:', totalCampaigns.toString());
  console.log('Total NFTs Minted:', totalSupply.toString());
  console.log('');
  
  // Get Campaign 0 (Liza's campaign)
  const c = await contract.getCampaign(0);
  const grossRaisedWei = BigInt(c.grossRaised);
  const grossRaisedETH = Number(grossRaisedWei) / 1e18;
  const grossRaisedUSD = grossRaisedETH * ETH_USD;
  const pricePerEditionWei = BigInt(c.pricePerEdition);
  const pricePerEditionETH = Number(pricePerEditionWei) / 1e18;
  const pricePerEditionUSD = pricePerEditionETH * ETH_USD;
  
  console.log('=== CAMPAIGN 0: A Mothers Fight ===');
  console.log('Creator:', c.creator);
  console.log('Price Per Edition (wei):', c.pricePerEdition.toString());
  console.log('Price Per Edition (ETH):', pricePerEditionETH.toFixed(8));
  console.log('Price Per Edition (USD):', pricePerEditionUSD.toFixed(2));
  console.log('Editions Minted:', c.editionsMinted.toString());
  console.log('Max Editions:', c.maxEditions.toString());
  console.log('Gross Raised (wei):', c.grossRaised.toString());
  console.log('Gross Raised (ETH):', grossRaisedETH.toFixed(8));
  console.log('Gross Raised (USD @ $3100):', grossRaisedUSD.toFixed(2));
  console.log('USD Price (stored on-chain):', c.usdPrice.toString());
  console.log('Exists:', c.exists);
  console.log('Paused:', c.paused);
  console.log('');
  
  // Calculate expected vs actual
  const expectedNFTSales = Number(c.editionsMinted) * pricePerEditionUSD;
  const tips = grossRaisedUSD - expectedNFTSales;
  
  console.log('=== CALCULATED VALUES ===');
  console.log('Expected NFT Sales (editions x price):', expectedNFTSales.toFixed(2));
  console.log('Tips/Gifts (grossRaised - nftSales):', tips.toFixed(2));
  console.log('Total Raised:', grossRaisedUSD.toFixed(2));
  
  return {
    editionsMinted: Number(c.editionsMinted),
    grossRaisedETH,
    grossRaisedUSD,
    pricePerEditionETH,
    pricePerEditionUSD,
    expectedNFTSales,
    tips,
    maxEditions: Number(c.maxEditions),
    creator: c.creator
  };
}

audit().catch(e => console.log('Error:', e.message));
