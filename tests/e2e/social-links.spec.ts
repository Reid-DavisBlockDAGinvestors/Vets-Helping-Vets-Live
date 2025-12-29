import { test, expect } from '@playwright/test'

test.describe('SocialLinks Component', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page where footer with social links will be
    await page.goto('/')
    // Wait for social links container to be visible before running tests
    await page.getByTestId('social-links').waitFor({ state: 'visible', timeout: 15000 })
  })

  test('should display all 8 social media icons', async ({ page }) => {
    const socialLinks = page.getByTestId('social-links')
    await expect(socialLinks).toBeVisible()
    
    // Check all 8 social links are present (including Discord)
    const links = socialLinks.locator('a')
    await expect(links).toHaveCount(8)
  })

  test('should have correct X (Twitter) link', async ({ page }) => {
    const xLink = page.getByTestId('social-link-x')
    await expect(xLink).toBeVisible()
    await expect(xLink).toHaveAttribute('href', 'https://x.com/blockdag2049')
    await expect(xLink).toHaveAttribute('target', '_blank')
  })

  test('should have correct Telegram link', async ({ page }) => {
    const telegramLink = page.getByTestId('social-link-telegram')
    await expect(telegramLink).toBeVisible()
    await expect(telegramLink).toHaveAttribute('href', 'https://t.me/+zuuA1U91bLBhOWMx')
  })

  test('should have correct Facebook link', async ({ page }) => {
    const facebookLink = page.getByTestId('social-link-facebook')
    await expect(facebookLink).toBeVisible()
    await expect(facebookLink).toHaveAttribute('href', 'https://www.facebook.com/share/g/17oU6dqmzW/')
  })

  test('should have correct Reddit link', async ({ page }) => {
    const redditLink = page.getByTestId('social-link-reddit')
    await expect(redditLink).toBeVisible()
    await expect(redditLink).toHaveAttribute('href', 'https://www.reddit.com/r/BlockDAGInvestors/')
  })

  test('should have correct TikTok link', async ({ page }) => {
    const tiktokLink = page.getByTestId('social-link-tiktok')
    await expect(tiktokLink).toBeVisible()
    await expect(tiktokLink).toHaveAttribute('href', 'https://www.tiktok.com/@blockdaginvestors')
  })

  test('should have correct LinkedIn link', async ({ page }) => {
    const linkedinLink = page.getByTestId('social-link-linkedin')
    await expect(linkedinLink).toBeVisible()
    await expect(linkedinLink).toHaveAttribute('href', 'https://www.linkedin.com/in/reid-davis-875446370')
  })

  test('should have correct YouTube link', async ({ page }) => {
    const youtubeLink = page.getByTestId('social-link-youtube')
    await expect(youtubeLink).toBeVisible()
    await expect(youtubeLink).toHaveAttribute('href', 'https://youtube.com/@blockdaginvestorschannel')
  })

  test('should have correct Discord link', async ({ page }) => {
    const discordLink = page.getByTestId('social-link-discord')
    await expect(discordLink).toBeVisible()
    await expect(discordLink).toHaveAttribute('href', 'https://discord.gg/9UkhuBz8GR')
  })

  test('all links should have aria-labels for accessibility', async ({ page }) => {
    const socialLinks = page.getByTestId('social-links')
    const links = socialLinks.locator('a')
    
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      const ariaLabel = await links.nth(i).getAttribute('aria-label')
      expect(ariaLabel).toBeTruthy()
    }
  })

  test('all links should open in new tab', async ({ page }) => {
    const socialLinks = page.getByTestId('social-links')
    const links = socialLinks.locator('a')
    
    const count = await links.count()
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toHaveAttribute('target', '_blank')
      await expect(links.nth(i)).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
