/**
 * Tests for IPFS utility functions
 * Following Test-Driven Design principles
 */

import {
  ipfsToHttp,
  httpToIpfs,
  isIpfsUri,
  getIpfsUrls,
  IPFS_GATEWAYS,
} from './ipfs'

describe('ipfsToHttp', () => {
  it('should convert ipfs:// URI to HTTP gateway URL', () => {
    const uri = 'ipfs://QmTest123456789'
    const result = ipfsToHttp(uri)
    expect(result).toContain('ipfs/QmTest123456789')
    expect(result.startsWith('https://')).toBe(true)
  })

  it('should return empty string for empty input', () => {
    expect(ipfsToHttp('')).toBe('')
  })

  it('should return original URL if not an IPFS URI', () => {
    const httpUrl = 'https://example.com/image.png'
    expect(ipfsToHttp(httpUrl)).toBe(httpUrl)
  })

  it('should handle IPFS URI without trailing content', () => {
    const uri = 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi'
    const result = ipfsToHttp(uri)
    expect(result).toContain('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')
  })
})

describe('httpToIpfs', () => {
  it('should return empty string for empty input', () => {
    expect(httpToIpfs('')).toBe('')
  })

  it('should return original URL if not a gateway URL', () => {
    const url = 'https://example.com/image.png'
    expect(httpToIpfs(url)).toBe(url)
  })

  it('should convert nftstorage.link gateway URL to ipfs://', () => {
    const url = 'https://nftstorage.link/ipfs/QmTest123'
    const result = httpToIpfs(url)
    expect(result).toBe('ipfs://QmTest123')
  })
})

describe('isIpfsUri', () => {
  it('should return true for valid IPFS URI', () => {
    expect(isIpfsUri('ipfs://QmTest123')).toBe(true)
  })

  it('should return false for HTTP URL', () => {
    expect(isIpfsUri('https://example.com')).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isIpfsUri('')).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isIpfsUri(null as any)).toBe(false)
    expect(isIpfsUri(undefined as any)).toBe(false)
  })
})

describe('getIpfsUrls', () => {
  it('should return empty array for empty input', () => {
    expect(getIpfsUrls('')).toEqual([])
  })

  it('should return array with original URL if not IPFS', () => {
    const url = 'https://example.com/image.png'
    expect(getIpfsUrls(url)).toEqual([url])
  })

  it('should return multiple gateway URLs for IPFS URI', () => {
    const uri = 'ipfs://QmTest123'
    const urls = getIpfsUrls(uri)
    
    expect(urls.length).toBe(IPFS_GATEWAYS.length)
    urls.forEach(url => {
      expect(url).toContain('QmTest123')
      expect(url.startsWith('https://')).toBe(true)
    })
  })
})

describe('IPFS_GATEWAYS', () => {
  it('should have at least 3 fallback gateways', () => {
    expect(IPFS_GATEWAYS.length).toBeGreaterThanOrEqual(3)
  })

  it('should all be HTTPS URLs', () => {
    IPFS_GATEWAYS.forEach(gateway => {
      expect(gateway.startsWith('https://')).toBe(true)
    })
  })

  it('should all end with /ipfs/', () => {
    IPFS_GATEWAYS.forEach(gateway => {
      expect(gateway.endsWith('/ipfs/')).toBe(true)
    })
  })
})
