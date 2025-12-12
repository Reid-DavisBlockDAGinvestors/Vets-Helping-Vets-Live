/**
 * IPFS utility functions for handling ipfs:// URIs
 */

/**
 * Convert IPFS URI (ipfs://...) to HTTP gateway URL for browser display
 * Uses Pinata gateway or public IPFS gateway
 */
export function ipfsToHttp(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('ipfs://')) {
    const cid = uri.replace('ipfs://', '')
    // Use Pinata gateway from env or fallback to default
    const gateway = process.env.PINATA_GATEWAY || process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'gateway.pinata.cloud'
    return `https://${gateway}/ipfs/${cid}`
  }
  return uri
}

/**
 * Convert HTTP gateway URL back to ipfs:// URI
 */
export function httpToIpfs(url: string): string {
  if (!url) return ''
  
  // Handle various gateway formats
  const patterns = [
    /https?:\/\/(?:[\w-]+\.)?ipfs\.(?:io|dweb\.link|nftstorage\.link)\/ipfs\/([a-zA-Z0-9]+)/,
    /https?:\/\/nftstorage\.link\/ipfs\/([a-zA-Z0-9]+)/,
    /https?:\/\/[\w-]+\.ipfs\.[\w.]+\/([a-zA-Z0-9]+)/,
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) {
      return `ipfs://${match[1]}`
    }
  }
  
  return url
}

/**
 * Check if a URI is an IPFS URI
 */
export function isIpfsUri(uri: string): boolean {
  return uri?.startsWith('ipfs://') || false
}

/**
 * Alternative IPFS gateways for fallback
 */
export const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
]

/**
 * Get image URL with gateway fallback
 * Returns an array of URLs to try in order
 */
export function getIpfsUrls(uri: string): string[] {
  if (!uri) return []
  if (!uri.startsWith('ipfs://')) return [uri]
  
  const cid = uri.replace('ipfs://', '')
  return IPFS_GATEWAYS.map(gateway => gateway + cid)
}
