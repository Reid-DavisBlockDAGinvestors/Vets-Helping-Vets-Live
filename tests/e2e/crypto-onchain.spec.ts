import { test, expect } from '@playwright/test'

// This test runs only when BDAG on-chain is enabled.
// It asserts a single on-chain transaction link is shown after purchase (contract-integrated path).

const ONCHAIN = process.env.BDAG_ENABLE_ONCHAIN === 'true'

test.describe('BDAG on-chain (single tx assertion)', () => {
  test.skip(!ONCHAIN, 'BDAG on-chain not enabled')

  test('shows explorer link for BDAG on-chain path', async ({ page }) => {
    await page.goto('/story/1')

    const onchainBtn = page.getByTestId('pay-crypto')
    await expect(onchainBtn).toBeVisible()
    const respPromise = page.waitForResponse(r => r.url().includes('/api/purchase') && r.request().method() === 'POST', { timeout: 60000 })
    await onchainBtn.click()
    const resp = await respPromise
    const body = await resp.json().catch(()=>({ parseError: true }))
    expect(resp.ok(), `purchase response not OK: ${JSON.stringify(body)}`).toBeTruthy()

    // Expect single explorer link
    await expect(page.getByText(/Txn Hash:/i)).toBeVisible({ timeout: 45000 })
    await expect(page.getByRole('link', { name: /View on Explorer/i })).toBeVisible()
  })
})
