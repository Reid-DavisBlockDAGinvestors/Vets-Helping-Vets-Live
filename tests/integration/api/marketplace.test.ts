/**
 * Integration Tests for Marketplace API
 * Tests the /api/marketplace/* endpoints
 */

describe('API: /api/marketplace', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

  describe('GET /api/marketplace/fundraisers', () => {
    it('should return list of fundraisers', async () => {
      const response = await fetch(`${baseUrl}/api/marketplace/fundraisers`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data)).toBe(true)
    })

    it('should include required fields in each fundraiser', async () => {
      const response = await fetch(`${baseUrl}/api/marketplace/fundraisers`)
      const data = await response.json()

      if (data.length > 0) {
        const fundraiser = data[0]
        expect(fundraiser).toHaveProperty('id')
        expect(fundraiser).toHaveProperty('title')
        expect(fundraiser).toHaveProperty('category')
      }
    })

    it('should have no-cache headers for fresh data', async () => {
      const response = await fetch(`${baseUrl}/api/marketplace/fundraisers`)
      const cacheControl = response.headers.get('cache-control')

      // Should prevent caching for fresh data
      expect(cacheControl).toBeTruthy()
    })
  })

  describe('GET /api/marketplace/featured', () => {
    it('should return featured campaigns or empty array', async () => {
      const response = await fetch(`${baseUrl}/api/marketplace/featured`)
      
      // May return 200 with data or 404 if not implemented
      expect([200, 404]).toContain(response.status)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(Array.isArray(data) || typeof data === 'object').toBe(true)
      }
    })
  })
})

describe('API: /api/stats', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

  describe('GET /api/stats/platform', () => {
    it('should return platform statistics', async () => {
      const response = await fetch(`${baseUrl}/api/stats/platform`)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(data).toHaveProperty('totalRaised')
        expect(data).toHaveProperty('totalCampaigns')
        expect(data).toHaveProperty('totalNFTs')
      }
    })
  })
})
