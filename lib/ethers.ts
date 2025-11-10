import { BrowserProvider, JsonRpcProvider } from 'ethers'

export function getBrowserProvider() {
  if (typeof window === 'undefined') return null
  const eth = (window as any).ethereum
  return eth ? new BrowserProvider(eth) : null
}

export function getRpcProvider() {
  const rpcs = [
    process.env.BLOCKDAG_RPC,
    process.env.BLOCKDAG_RPC_FALLBACK,
    'https://rpc.awakening.bdagscan.com',
    'https://nownodes.io/nodes/bdag-blockdag'
  ].filter(Boolean) as string[]
  const url = rpcs[0]
  return new JsonRpcProvider(url)
}

export function getPrimaryRpcUrl() {
  return (
    process.env.BLOCKDAG_RPC ||
    process.env.BLOCKDAG_RPC_FALLBACK ||
    'https://rpc.awakening.bdagscan.com'
  )
}
