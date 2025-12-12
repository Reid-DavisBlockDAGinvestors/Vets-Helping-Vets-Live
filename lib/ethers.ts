import { BrowserProvider, JsonRpcProvider, FetchRequest } from 'ethers'

export function getBrowserProvider() {
  if (typeof window === 'undefined') return null
  const eth = (window as any).ethereum
  return eth ? new BrowserProvider(eth) : null
}

export function getRpcProvider() {
  const rpcs = [
    process.env.BLOCKDAG_RPC,
    process.env.BLOCKDAG_RPC_FALLBACK,
    process.env.BLOCKDAG_RELAYER_RPC,
    process.env.RELAYER_RPC,
    'https://rpc.awakening.bdagscan.com',
    'https://relay.awakening.bdagscan.com',
  ].filter(Boolean) as string[]
  const url = rpcs[0]
  
  // Check if using NowNodes and add API key header
  const nowNodesKey = process.env.NOWNODES_API_KEY
  if (url.includes('nownodes.io') && nowNodesKey) {
    const fetchReq = new FetchRequest(url)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  
  return new JsonRpcProvider(url)
}

export function getPrimaryRpcUrl() {
  return (
    process.env.BLOCKDAG_RPC ||
    process.env.BLOCKDAG_RPC_FALLBACK ||
    process.env.BLOCKDAG_RELAYER_RPC ||
    process.env.RELAYER_RPC ||
    'https://rpc.awakening.bdagscan.com'
  )
}

// Create a provider for a given RPC URL with NowNodes API key support
export function createProvider(rpcUrl: string): JsonRpcProvider {
  const nowNodesKey = process.env.NOWNODES_API_KEY
  if (rpcUrl.includes('nownodes.io') && nowNodesKey) {
    const fetchReq = new FetchRequest(rpcUrl)
    fetchReq.setHeader('api-key', nowNodesKey)
    return new JsonRpcProvider(fetchReq, undefined, { staticNetwork: true })
  }
  return new JsonRpcProvider(rpcUrl)
}

// Placeholder explorer links for various chains
export function getExplorerUrl(asset: string, txHash: string) {
  const a = asset.toUpperCase()
  if (a === 'ETH') return `https://etherscan.io/tx/${txHash}`
  if (a === 'BTC') return `https://mempool.space/tx/${txHash}`
  if (a === 'SOL') return `https://solscan.io/tx/${txHash}`
  if (a === 'XRP') return `https://livenet.xrpl.org/transactions/${txHash}`
  if (a === 'BDAG') {
    const base = process.env.NEXT_PUBLIC_EXPLORER_BASE || process.env.EXPLORER_BASE || 'https://awakening.bdagscan.com'
    return `${base.replace(/\/$/, '')}/tx/${txHash}`
  }
  return '#'
}

export function getExplorerAddressUrl(asset: string, address: string) {
  const a = asset.toUpperCase()
  if (a === 'ETH') return `https://etherscan.io/address/${address}`
  if (a === 'BTC') return `https://mempool.space/address/${address}`
  if (a === 'SOL') return `https://solscan.io/account/${address}`
  if (a === 'XRP') return `https://livenet.xrpl.org/accounts/${address}`
  if (a === 'BDAG') {
    const base = process.env.NEXT_PUBLIC_EXPLORER_BASE || process.env.EXPLORER_BASE || 'https://awakening.bdagscan.com'
    return `${base.replace(/\/$/, '')}/address/${address}`
  }
  return '#'
}

// Placeholder price oracle (USD per asset)
export function getMockUsdPrice(asset: string): number | null {
  const a = asset.toUpperCase()
  const table: Record<string, number> = {
    BDAG: 0.05,
    ETH: 3200,
    BTC: 65000,
    SOL: 120,
    XRP: 0.55,
  }
  return table[a] ?? null
}

// Alias for future Chainlink integration
export const getUsdPrice = getMockUsdPrice
