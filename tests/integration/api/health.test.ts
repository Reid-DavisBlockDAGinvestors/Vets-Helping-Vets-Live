/**
 * Integration Tests for Health API
 * Tests the /api/health endpoint
 */

describe('API: /api/health', () => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${baseUrl}/api/health`)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.timestamp).toBeDefined()
      expect(typeof data.uptime).toBe('number')
    })

    it('should include environment info', async () => {
      const response = await fetch(`${baseUrl}/api/health`)
      const data = await response.json()

      expect(data.environment).toBeDefined()
      expect(['development', 'production', 'test']).toContain(data.environment)
    })

    it('should have no-store cache header', async () => {
      const response = await fetch(`${baseUrl}/api/health`)
      const cacheControl = response.headers.get('cache-control')

      expect(cacheControl).toContain('no-store')
    })
  })
})
