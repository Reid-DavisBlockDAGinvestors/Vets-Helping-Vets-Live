import { test, expect } from '@playwright/test'

const ONCHAIN = process.env.NEXT_PUBLIC_BDAG_ONCHAIN === 'true' || process.env.BDAG_ENABLE_ONCHAIN === 'true'

// E2E crypto mock flows: BDAG native and ETH conversion
// Verifies explorer links and USD->asset conversion text are shown

test.describe('Crypto purchase flows (mock)', () => {
  test.skip(ONCHAIN, 'BDAG on-chain active; skipping BDAG mock flow in this spec')
  test('BDAG purchase shows explorer link and conversion', async ({ page }) => {
    await page.goto('/story/1')
    // Handle any alert that might appear (e.g., missing address)
    page.on('dialog', async d => { try { await d.accept(); } catch {} })

    // Ensure crypto section is present
    const onchainBtn = page.getByRole('button', { name: /Pay with BDAG \(On‑chain\)/i })
    const mockBtn = page.getByRole('button', { name: /Pay with Crypto \(Mock\)/i })
    if (await onchainBtn.count()) {
      test.skip(true, 'BDAG on-chain active in UI; skipping BDAG mock flow in this spec')
    }
    // Click on-chain if active, otherwise mock
    if (await onchainBtn.count()) {
      await expect(onchainBtn).toBeVisible()
      // Fill creator wallet if required in on-chain mode
      const requiredInput = page.getByPlaceholder('Required for BDAG on-chain (0x...)')
      const optionalInput = page.getByPlaceholder('0x... / addr...')
      if (await requiredInput.count()) {
        await requiredInput.fill('0x07b3c4bb8842a9ee0698f1a3c6778bcc456d9362')
      } else if (await optionalInput.count()) {
        await optionalInput.fill('0x07b3c4bb8842a9ee0698f1a3c6778bcc456d9362')
      }
      await onchainBtn.scrollIntoViewIfNeeded()
      await onchainBtn.click({ force: true })
    } else {
      await expect(mockBtn).toBeVisible()
      await mockBtn.scrollIntoViewIfNeeded()
      await mockBtn.click({ force: true })
    }

    // Expect txn details (allow extra time for on-chain path)
    await page.waitForSelector('text=Txn Hash:', { timeout: 30000 })
    const explorer = page.getByRole('link', { name: /View on Explorer/i })
    await expect(explorer).toBeVisible()
    await expect(explorer).toHaveAttribute('href', /\/tx\//i)

    // Conversion line shows USD->BDAG
    await expect(page.getByText(/USD→BDAG/i)).toBeVisible()
  })

  test('ETH purchase shows explorer link and conversion', async ({ page }) => {
    await page.goto('/story/1')

    // Switch asset to ETH in the select
    const selects = page.locator('select')
    await expect(selects.first()).toBeVisible()
    await selects.first().selectOption('ETH')

    // Click crypto pay
    const payCryptoBtn = page.getByRole('button', { name: /Pay with Crypto \(Mock\)/i })
    await payCryptoBtn.click()

    // Expect mock txn details for ETH
    await expect(page.getByText(/Txn Hash:/i)).toBeVisible()
    const explorer = page.getByRole('link', { name: /View on Explorer/i })
    await expect(explorer).toBeVisible()
    await expect(explorer).toHaveAttribute('href', /etherscan/i)

    // Conversion line shows USD->ETH
    await expect(page.getByText(/USD→ETH/i)).toBeVisible()
  })
})
