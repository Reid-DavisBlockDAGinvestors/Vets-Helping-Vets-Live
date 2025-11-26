import { expect } from 'chai'
import hardhat from 'hardhat'
const { ethers } = hardhat as any

describe('PatriotPledgeNFT - campaign series', function () {
  it('deploys, mints series, buys, releases, and updates progress', async function () {
    const [deployer, nonprofit, creator, buyer] = await ethers.getSigners()

    const FeeBps = 100 // 1%
    const Patriot = await ethers.getContractFactory('PatriotPledgeNFT')
    const contract = await Patriot.deploy(nonprofit.address, FeeBps)
    await contract.waitForDeployment()

    // mint a campaign series
    const size = 3
    const priceWei = ethers.parseEther('1')
    const goalWei = ethers.parseEther('5')
    const baseURI = 'ipfs://base-json'
    const cat = 'general'

    const mintTx = await contract.mintSeries(size, priceWei, goalWei, creator.address, baseURI, cat)
    const mintRcpt = await mintTx.wait()
    expect(mintRcpt?.hash).to.be.a('string')

    // Read back campaign 1
    const c = await contract.campaigns(1)
    expect(c.priceWei).to.equal(priceWei)
    expect(c.size).to.equal(BigInt(size))
    expect(c.creator).to.equal(creator.address)
    expect(c.active).to.equal(true)

    // Buyer purchases one NFT
    const raisedBefore = (await contract.campaigns(1)).raisedWei
    const contractBalBefore = await ethers.provider.getBalance(await contract.getAddress())
    const buyTx = await contract.connect(buyer).buy(1, { value: priceWei })
    await buyTx.wait()

    const cAfterBuy = await contract.campaigns(1)
    expect(cAfterBuy.sold).to.equal(1n)
    expect(cAfterBuy.raisedWei - raisedBefore).to.equal(priceWei)
    const tokenId = Number(c.startTokenId) // first token in series should have been sold
    const newOwner = await contract.ownerOf(tokenId)
    expect(newOwner).to.equal(buyer.address)
    const contractBalAfter = await ethers.provider.getBalance(await contract.getAddress())
    expect(contractBalAfter - contractBalBefore).to.equal(priceWei)

    // Oracle (owner by default) releases partial funds (e.g., 0.5 ETH)
    const amountWei = ethers.parseEther('0.5')
    const releasedBefore = (await contract.campaigns(1)).releasedWei
    const contractBalBeforeRelease = await ethers.provider.getBalance(await contract.getAddress())
    const relTx = await contract.releaseFunds(1, amountWei, 1)
    await relTx.wait()

    const cAfterRel = await contract.campaigns(1)
    expect(cAfterRel.releasedWei - releasedBefore).to.equal(amountWei)
    const contractBalAfterRelease = await ethers.provider.getBalance(await contract.getAddress())
    expect(contractBalBeforeRelease - contractBalAfterRelease).to.equal(amountWei)

    // Update campaign progress
    await (await contract.updateCampaignProgress(1, 42)).wait()
    const prog = await contract.getCampaignProgress(1)
    expect(Number(prog)).to.equal(42)
  })
})
