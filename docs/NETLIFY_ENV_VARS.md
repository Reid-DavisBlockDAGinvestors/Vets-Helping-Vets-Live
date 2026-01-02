# Netlify Environment Variables

## Required for Multi-Chain Deployment

### BlockDAG (Chain ID: 1043)
```
BLOCKDAG_RPC=https://bdag.nownodes.io
BDAG_RELAYER_KEY=<private_key_for_blockdag>
NOWNODES_API_KEY=<nownodes_api_key>
```

### Sepolia Testnet (Chain ID: 11155111)
```
ETHEREUM_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
ETH_DEPLOYER_KEY=<private_key_for_sepolia>
```

### Ethereum Mainnet (Chain ID: 1) - Future
```
ETHEREUM_RPC=https://eth.llamarpc.com
ETH_MAINNET_KEY=<gnosis_safe_multisig_recommended>
```

## How to Add to Netlify

1. Go to https://app.netlify.com
2. Select your site (patriotpledge-nfts)
3. Site settings → Environment variables
4. Add each variable listed above

## CRITICAL: Missing Variable Error

If you see this error:
```
MISSING_SEPOLIA_KEY - ETH_DEPLOYER_KEY not configured for Sepolia deployment
```

You need to add `ETH_DEPLOYER_KEY` to Netlify with the private key that deployed the V7 contract to Sepolia.

## Security Notes

- NEVER commit private keys to git
- Use Netlify's environment variable encryption
- For mainnet, consider using Gnosis Safe multi-sig instead of single private key
- Rotate keys if compromised

## Price Conversion Variables

```
BDAG_USD_RATE=0.05
ETH_USD_RATE=2300
```

These are used to convert USD prices to native token amounts.
