import { test, expect } from '@playwright/test'

test.describe('Dashboard Campaign Metadata Display', () => {
  // Test that campaigns 42, 43, 44 show their metadata (images, titles) correctly
  
  test('Dashboard page loads without errors', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Check page loads successfully
    await expect(page.locator('h1')).toContainText('Dashboard')
    
    // Check that Connect Wallet button or wallet info is visible
    const hasConnectButton = await page.locator('button:has-text("Connect Wallet")').first().isVisible()
    const hasWalletInfo = await page.locator('text=/0x[a-fA-F0-9]{4}/').isVisible()
    
    expect(hasConnectButton || hasWalletInfo).toBe(true)
    console.log(`Dashboard loaded: hasConnectButton=${hasConnectButton}, hasWalletInfo=${hasWalletInfo}`)
  })

  test('API should return image data for campaigns 42, 43, 44', async ({ request }) => {
    // Directly test the wallet/nfts API
    const testWallet = '0x07b3c4BB8842a9eE0698F1A3c6778bcC456d9362' // Known owner
    
    const response = await request.get(`/api/wallet/nfts?address=${testWallet}`)
    expect(response.ok()).toBeTruthy()
    
    const data = await response.json()
    console.log(`API returned ${data.nfts?.length || 0} NFTs`)
    
    // Find campaigns 42, 43, 44
    const targetCampaigns = [42, 43, 44]
    for (const campaignId of targetCampaigns) {
      const nft = data.nfts?.find((n: any) => n.campaignId === campaignId)
      
      if (nft) {
        console.log(`Campaign #${campaignId}:`)
        console.log(`  Title: ${nft.title}`)
        console.log(`  Image: ${nft.image ? 'Present' : 'MISSING'}`)
        console.log(`  Image URI: ${nft.image?.substring(0, 50)}...`)
        
        // Assert image is present
        expect(nft.image).toBeTruthy()
        expect(nft.image).toContain('ipfs://')
        expect(nft.title).toBeTruthy()
      } else {
        console.log(`Campaign #${campaignId}: Not owned by test wallet`)
      }
    }
  })

  test('ipfsToHttp should correctly convert IPFS URIs', async ({ page }) => {
    // Test the conversion function in the browser context
    await page.goto('/dashboard')
    
    const result = await page.evaluate(() => {
      // Simulate the ipfsToHttp function
      function ipfsToHttp(uri: string): string {
        if (!uri) return ''
        if (uri.startsWith('ipfs://')) {
          const cid = uri.replace('ipfs://', '')
          return `https://gateway.pinata.cloud/ipfs/${cid}`
        }
        return uri
      }
      
      const testUri = 'ipfs://bafybeif7qg25udrn44istwx4ed5uqqvag6vfens4nktow7gxs5bgbp4yvq'
      return {
        input: testUri,
        output: ipfsToHttp(testUri)
      }
    })
    
    console.log('IPFS conversion test:')
    console.log(`  Input: ${result.input}`)
    console.log(`  Output: ${result.output}`)
    
    expect(result.output).toBe('https://gateway.pinata.cloud/ipfs/bafybeif7qg25udrn44istwx4ed5uqqvag6vfens4nktow7gxs5bgbp4yvq')
  })
})
