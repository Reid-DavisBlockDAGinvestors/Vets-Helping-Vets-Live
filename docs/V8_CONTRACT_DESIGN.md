# PatriotPledge NFT V8 Contract Design
> Adjustable Dual-Fee System with Platform + Nonprofit Split

## Overview

V8 introduces a **dual-fee system** that separates platform operational fees from nonprofit treasury fees, giving full transparency and flexibility.

---

## Fee Distribution (V8)

| Recipient | Fee | Purpose | Wallet |
|-----------|-----|---------|--------|
| **Platform (Deployer)** | 1% (100 bps) | Operational costs, gas, deployments | Deployer/Owner wallet |
| **Nonprofit Treasury** | 1% (100 bps) | Nonprofit operations | `0xbFD14c5A940E783AEc1993598143B59D3C971eF1` |
| **Campaign Creator** | 98% | Goes directly to fundraiser | Submitter wallet |

### Example: $100 NFT Purchase
- **$1.00** → Platform wallet (for deploying more fundraisers)
- **$1.00** → Nonprofit treasury (organizational costs)
- **$98.00** → Campaign creator (the veteran/first responder)

---

## V8 Key Changes from V7

### 1. Dual Fee Configuration
```solidity
struct FeeConfig {
    uint16 platformFeeBps;     // Platform fee (default 100 = 1%)
    uint16 nonprofitFeeBps;    // Nonprofit fee (default 100 = 1%)
    bool immediatePayout;      // Enable immediate payouts globally
}

// Separate treasury addresses
address public platformTreasury;    // Deployer wallet - for operations
address public nonprofitTreasury;   // 0xbFD14c5A940E783AEc1993598143B59D3C971eF1
```

### 2. Updated Fund Distribution
```solidity
function _distributeFunds(
    uint256 campaignId,
    uint256 contribution,
    uint256 tipAmount
) internal {
    Campaign storage c = campaigns[campaignId];
    
    // Calculate fees
    uint256 platformFee = (contribution * feeConfig.platformFeeBps) / BPS_DENOMINATOR;
    uint256 nonprofitFee = (contribution * feeConfig.nonprofitFeeBps) / BPS_DENOMINATOR;
    
    // Submitter receives: contribution - platformFee - nonprofitFee + tips
    uint256 submitterAmount = contribution - platformFee - nonprofitFee + tipAmount;
    
    // Send platform fee to deployer
    if (platformFee > 0) {
        (bool s1, ) = platformTreasury.call{value: platformFee}("");
        require(s1, "Platform fee transfer failed");
        emit ImmediatePayoutSent(campaignId, platformTreasury, platformFee, "platform");
    }
    
    // Send nonprofit fee to nonprofit treasury
    if (nonprofitFee > 0) {
        (bool s2, ) = nonprofitTreasury.call{value: nonprofitFee}("");
        require(s2, "Nonprofit fee transfer failed");
        emit ImmediatePayoutSent(campaignId, nonprofitTreasury, nonprofitFee, "nonprofit");
    }
    
    // Send remainder + tips to submitter
    if (submitterAmount > 0) {
        (bool s3, ) = c.submitter.call{value: submitterAmount}("");
        require(s3, "Submitter transfer failed");
        emit ImmediatePayoutSent(campaignId, c.submitter, submitterAmount, "submitter");
    }
    
    emit FundsDistributed(
        campaignId,
        c.submitter,
        submitterAmount,
        platformFee,
        nonprofitFee,
        tipAmount
    );
}
```

### 3. Adjustable Fees (Admin Functions)
```solidity
function setPlatformFee(uint16 newFeeBps) external onlyOwner {
    require(newFeeBps <= MAX_SINGLE_FEE_BPS, "Fee too high");
    feeConfig.platformFeeBps = newFeeBps;
    emit FeeConfigUpdated(feeConfig.platformFeeBps, feeConfig.nonprofitFeeBps, feeConfig.immediatePayout);
}

function setNonprofitFee(uint16 newFeeBps) external onlyOwner {
    require(newFeeBps <= MAX_SINGLE_FEE_BPS, "Fee too high");
    feeConfig.nonprofitFeeBps = newFeeBps;
    emit FeeConfigUpdated(feeConfig.platformFeeBps, feeConfig.nonprofitFeeBps, feeConfig.immediatePayout);
}

function setNonprofitTreasury(address newTreasury) external onlyOwner {
    require(newTreasury != address(0), "Invalid treasury");
    address oldTreasury = nonprofitTreasury;
    nonprofitTreasury = newTreasury;
    emit NonprofitTreasuryUpdated(oldTreasury, newTreasury);
}
```

---

## Constructor (V8)

```solidity
constructor(
    address _platformTreasury,      // Deployer wallet
    address _nonprofitTreasury,     // 0xbFD14c5A940E783AEc1993598143B59D3C971eF1
    uint16 _platformFeeBps,         // 100 = 1%
    uint16 _nonprofitFeeBps         // 100 = 1%
) ERC721("PatriotPledge Edition", "PPE") Ownable(msg.sender) {
    require(_platformTreasury != address(0), "Invalid platform treasury");
    require(_nonprofitTreasury != address(0), "Invalid nonprofit treasury");
    require(_platformFeeBps + _nonprofitFeeBps <= MAX_FEE_BPS, "Combined fees too high");
    
    platformTreasury = _platformTreasury;
    nonprofitTreasury = _nonprofitTreasury;
    deploymentChainId = block.chainid;
    
    feeConfig = FeeConfig({
        platformFeeBps: _platformFeeBps,
        nonprofitFeeBps: _nonprofitFeeBps,
        immediatePayout: false
    });
    
    _setDefaultRoyalty(_platformTreasury, defaultRoyaltyBps);
}
```

---

## Deployment Parameters

### BlockDAG Testnet (Chain ID: 1043)
```
platformTreasury: <deployer_wallet>
nonprofitTreasury: 0xbFD14c5A940E783AEc1993598143B59D3C971eF1
platformFeeBps: 100 (1%)
nonprofitFeeBps: 100 (1%)
```

### Ethereum Mainnet (Chain ID: 1)
```
platformTreasury: <gnosis_safe_multisig>
nonprofitTreasury: 0xbFD14c5A940E783AEc1993598143B59D3C971eF1
platformFeeBps: 100 (1%)
nonprofitFeeBps: 100 (1%)
```

---

## Security Thresholds

| Parameter | Max Value | Notes |
|-----------|-----------|-------|
| `platformFeeBps` | 1000 (10%) | Single fee cap |
| `nonprofitFeeBps` | 1000 (10%) | Single fee cap |
| Combined fees | 3000 (30%) | Total cap |
| Fee change | 500 bps (5%) | Max change per tx |

---

## Events (V8 New)

```solidity
event NonprofitTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
event FeeConfigUpdated(uint16 platformFeeBps, uint16 nonprofitFeeBps, bool immediatePayout);
```

---

## Migration Path

### From V7 to V8
1. Deploy V8 with both treasury addresses
2. Migrate active campaigns (or create new ones)
3. Update frontend to recognize V8 contract version
4. Old V5/V6/V7 campaigns continue to work as-is

### Database Updates
Add to `submissions` table:
```sql
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS platform_fee_bps INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS nonprofit_fee_bps INTEGER DEFAULT 100;
```

---

## Summary

**V8 answers your question: YES!**
- ✅ 1% goes to deployer wallet (platform operations)
- ✅ 1% goes to nonprofit treasury (`0xbFD14c5A940E783AEc1993598143B59D3C971eF1`)
- ✅ 98% goes to campaign creator (submitter)
- ✅ Fees are adjustable on-chain by admin
- ✅ Tips still go 100% to submitter (or split per tip_splits table)

---

*Last Updated: January 2, 2026*
