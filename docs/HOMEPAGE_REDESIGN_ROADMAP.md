# Homepage Redesign Roadmap

## Overview
This document outlines the comprehensive redesign of the PatriotPledge NFTs homepage to support multi-chain campaigns, featured content, and improved user experience.

---

## Phase 1: Branding Updates

### Current State
- "Powered by BlockDAG Blockchain" - Too specific to one chain
- "Empowering Veterans Through Transparent Giving" - Too veteran-focused

### New Branding
- **Tagline Options:**
  - "Powered by Multi-Chain Technology"
  - "Built on Multi-Chain Architecture"
  - "Blockchain-Powered Transparency"
  
- **Headline Options:**
  - "Be Your Brother's Keeper — Transparent Giving for Everyone"
  - "Community-Powered Giving with Full Transparency"
  - "Support Your Community Through Transparent Blockchain Giving"
  
- **Subheadline Focus Areas:**
  - Veterans & First Responders
  - Natural Disaster Relief
  - Community Support
  - Medical Emergencies
  - General Humanitarian Causes

---

## Phase 2: Featured Campaigns System

### Database Schema
```sql
ALTER TABLE submissions ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN featured_order INTEGER DEFAULT 0;
ALTER TABLE submissions ADD COLUMN featured_at TIMESTAMPTZ;
```

### Admin UI
- Add "⭐ Feature" button on campaign cards in Admin Campaign Hub
- Featured campaigns appear at top of marketplace
- Featured campaigns get prominent homepage placement
- Limit: 3 featured campaigns at a time

### Homepage Display
- Featured campaign panel with:
  - Large image
  - Campaign title and summary
  - Progress bar
  - 💎 LIVE / 🧪 TESTNET badge
  - Direct purchase CTA
  - YouTube video embed (if available) side-by-side

---

## Phase 3: Stats Display Fix

### Current Issues
- Test value shows $0
- Doesn't properly aggregate mainnet vs testnet funds
- Chain classification not propagating correctly

### Fix Strategy
1. Update homepage stats to query with proper chain_id joins
2. Show mainnet total prominently (real money)
3. Show testnet total separately with clear distinction
4. Format: "💎 $453 Raised (Live) | 🧪 ~$17K (Test)"

---

## Phase 4: Tutorial/Instructions Page

### New Page: `/tutorials`
Move all chain setup instructions to a dedicated tutorials page:

1. **How to Set Up MetaMask**
   - Download & install
   - Create/import wallet
   
2. **Network Setup Guides**
   - Ethereum Mainnet (default in MetaMask)
   - BlockDAG Awakening Testnet
   - Sepolia Testnet
   - Future: Polygon, Base, Arbitrum
   
3. **How to Purchase NFTs**
   - Connect wallet
   - Select campaign
   - Complete purchase
   - View NFT in wallet

4. **Video Tutorials**
   - Current YouTube tutorial
   - Future chain-specific tutorials

### Homepage Link
Small card/button on homepage: "📚 Learn How It Works →"

---

## Phase 5: Story Page Video Prominence

### Current Layout
```
[Image]                    [Purchase Panel]
[Title + Progress]
[About This Fundraiser]
  ... long text ...
  [Campaign Video - buried at bottom]
[Milestones]
[Share]
```

### New Layout
```
[Image]                    [Purchase Panel]
[YouTube Video Embed]      
[Title + Progress]
[About This Fundraiser]
  [📹 Watch Video - link only]
  ... text ...
[Milestones]
[Share]
```

---

## Saved Testnet Instructions (Archive)

The following content was removed from the homepage but preserved for the tutorials page:

### BlockDAG Awakening Testnet Setup

**Network Details:**
- Network Name: BlockDAG Awakening
- RPC URL: https://rpc.awakening.bdagscan.com
- Chain ID: 1043
- Currency Symbol: BDAG
- Block Explorer: https://awakening.bdagscan.com

**How to Add:**
1. Open MetaMask
2. Click network dropdown
3. "Add Network" → "Add a network manually"
4. Enter the details above
5. Save

### Getting BDAG Tokens
- Get free testnet BDAG from the [BlockDAG Explorer Faucet](https://awakening.bdagscan.com/faucet)

### Purchase Steps
1. Browse campaigns on the Marketplace
2. Click "View Story" on a campaign
3. Connect your wallet by clicking "Connect Wallet"
4. Select quantity and optionally add a tip
5. Click "Purchase with BDAG" and confirm in MetaMask
6. Your NFT will appear in your MetaMask NFT tab

### Video Tutorial
- YouTube: https://www.youtube.com/watch?v=xkYcSQdnMXs

---

## Implementation Priority

1. ✅ Create this roadmap
2. Add `is_featured` column to submissions
3. Fix homepage stats calculation
4. Update hero section branding
5. Create featured campaign section
6. Move video on story page
7. Fix 💎 LIVE badge display
8. Create /tutorials page
9. Final Playwright verification

---

## Design Notes

### Color Scheme
- Mainnet/Live: Green (#22c55e) with 💎 diamond emoji
- Testnet: Orange (#f97316) with 🧪 test tube emoji
- Community focus: Blue/Purple gradients

### Featured Campaign Card
- Full-width on mobile
- 60/40 split on desktop (campaign | video)
- Prominent CTA button
- Chain badge visible

---

*Created: January 3, 2026*
*Last Updated: January 3, 2026*
