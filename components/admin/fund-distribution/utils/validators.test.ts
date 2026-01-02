import { describe, it, expect } from 'vitest'
import {
  validateTipSplit,
  validateDistributionAmount,
  validateWalletAddress,
  validateDistributionParams,
  calculateTipSplitAmounts,
  validateMainnetDistribution
} from './validators'
import type { CampaignBalance, DistributionParams } from '../types'

/**
 * Financial-Grade Validator Unit Tests
 * These tests ensure monetary operations are secure and accurate
 */

describe('Fund Distribution Validators', () => {
  
  describe('validateTipSplit', () => {
    it('should accept valid 100% total splits', () => {
      expect(validateTipSplit(100, 0)).toEqual({ valid: true })
      expect(validateTipSplit(0, 100)).toEqual({ valid: true })
      expect(validateTipSplit(70, 30)).toEqual({ valid: true })
      expect(validateTipSplit(50, 50)).toEqual({ valid: true })
      expect(validateTipSplit(1, 99)).toEqual({ valid: true })
    })

    it('should reject splits not totaling 100%', () => {
      expect(validateTipSplit(70, 40).valid).toBe(false)
      expect(validateTipSplit(50, 40).valid).toBe(false)
      expect(validateTipSplit(0, 0).valid).toBe(false)
      expect(validateTipSplit(100, 100).valid).toBe(false)
    })

    it('should reject negative values', () => {
      expect(validateTipSplit(-10, 110).valid).toBe(false)
      expect(validateTipSplit(110, -10).valid).toBe(false)
    })

    it('should reject values over 100', () => {
      expect(validateTipSplit(101, 0).valid).toBe(false)
      expect(validateTipSplit(0, 101).valid).toBe(false)
    })

    it('should reject non-integer values', () => {
      expect(validateTipSplit(70.5, 29.5).valid).toBe(false)
      expect(validateTipSplit(33.33, 66.67).valid).toBe(false)
    })
  })

  describe('validateDistributionAmount', () => {
    it('should accept valid amounts within balance', () => {
      expect(validateDistributionAmount(100, 500)).toEqual({ valid: true })
      expect(validateDistributionAmount(500, 500)).toEqual({ valid: true })
      expect(validateDistributionAmount(0.001, 1)).toEqual({ valid: true })
    })

    it('should reject amounts greater than balance', () => {
      const result = validateDistributionAmount(1000, 500)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exceeds')
    })

    it('should reject zero amounts', () => {
      expect(validateDistributionAmount(0, 500).valid).toBe(false)
    })

    it('should reject negative amounts', () => {
      expect(validateDistributionAmount(-100, 500).valid).toBe(false)
    })

    it('should reject NaN', () => {
      expect(validateDistributionAmount(NaN, 500).valid).toBe(false)
    })

    it('should handle small valid amounts', () => {
      // Very small but valid amounts (within 18 decimal precision)
      expect(validateDistributionAmount(0.000000000000000001, 1).valid).toBe(true)
    })
  })

  describe('validateWalletAddress', () => {
    it('should accept valid Ethereum addresses', () => {
      expect(validateWalletAddress('0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd9')).toEqual({ valid: true })
      expect(validateWalletAddress('0x0000000000000000000000000000000000000001')).toEqual({ valid: true })
      expect(validateWalletAddress('0xABCDEF0123456789ABCDEF0123456789ABCDEF01')).toEqual({ valid: true })
    })

    it('should reject null/undefined addresses', () => {
      expect(validateWalletAddress(null).valid).toBe(false)
      expect(validateWalletAddress(undefined).valid).toBe(false)
    })

    it('should reject empty string', () => {
      expect(validateWalletAddress('').valid).toBe(false)
    })

    it('should reject addresses without 0x prefix', () => {
      expect(validateWalletAddress('5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd9').valid).toBe(false)
    })

    it('should reject addresses with wrong length', () => {
      expect(validateWalletAddress('0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd').valid).toBe(false)
      expect(validateWalletAddress('0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd9A').valid).toBe(false)
    })

    it('should reject zero address', () => {
      expect(validateWalletAddress('0x0000000000000000000000000000000000000000').valid).toBe(false)
    })

    it('should reject addresses with invalid characters', () => {
      expect(validateWalletAddress('0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4ddG').valid).toBe(false)
    })
  })

  describe('validateDistributionParams', () => {
    const mockBalance: CampaignBalance = {
      campaignId: 'test-123',
      title: 'Test Campaign',
      status: 'minted',
      chainId: 11155111,
      chainName: 'Sepolia',
      isTestnet: true,
      contractVersion: 'V7',
      immediatePayoutEnabled: false,
      submitterWallet: '0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd9',
      nonprofitWallet: '0x1234567890123456789012345678901234567890',
      tipSplitSubmitterPct: 70,
      tipSplitNonprofitPct: 30,
      grossRaisedUsd: 1000,
      grossRaisedNative: 0.5,
      tipsReceivedUsd: 100,
      tipsReceivedNative: 0.05,
      totalDistributed: 0,
      tipsDistributed: 0,
      lastDistributionAt: null,
      pendingDistributionNative: 0.5,
      pendingTipsNative: 0.05,
      nativeCurrency: 'ETH',
      distributionCount: 0
    }

    it('should accept valid distribution params', () => {
      const params: DistributionParams = {
        campaignId: 'test-123',
        amount: 0.25,
        recipient: 'submitter'
      }
      expect(validateDistributionParams(params, mockBalance)).toEqual({ valid: true })
    })

    it('should reject when no pending funds', () => {
      const noPendingBalance = { ...mockBalance, pendingDistributionNative: 0 }
      const params: DistributionParams = {
        campaignId: 'test-123',
        amount: 0.1,
        recipient: 'submitter'
      }
      expect(validateDistributionParams(params, noPendingBalance).valid).toBe(false)
    })

    it('should reject when submitter wallet is missing', () => {
      const noWalletBalance = { ...mockBalance, submitterWallet: null }
      const params: DistributionParams = {
        campaignId: 'test-123',
        amount: 0.1,
        recipient: 'submitter'
      }
      expect(validateDistributionParams(params, noWalletBalance).valid).toBe(false)
    })

    it('should reject when nonprofit wallet is missing for nonprofit recipient', () => {
      const noNonprofitBalance = { ...mockBalance, nonprofitWallet: null }
      const params: DistributionParams = {
        campaignId: 'test-123',
        amount: 0.1,
        recipient: 'nonprofit'
      }
      expect(validateDistributionParams(params, noNonprofitBalance).valid).toBe(false)
    })
  })

  describe('calculateTipSplitAmounts', () => {
    it('should calculate 70/30 split correctly', () => {
      const result = calculateTipSplitAmounts(100, { submitterPercent: 70, nonprofitPercent: 30 })
      expect(result.submitterAmount).toBe(70)
      expect(result.nonprofitAmount).toBe(30)
    })

    it('should calculate 100/0 split correctly', () => {
      const result = calculateTipSplitAmounts(100, { submitterPercent: 100, nonprofitPercent: 0 })
      expect(result.submitterAmount).toBe(100)
      expect(result.nonprofitAmount).toBe(0)
    })

    it('should calculate 0/100 split correctly', () => {
      const result = calculateTipSplitAmounts(100, { submitterPercent: 0, nonprofitPercent: 100 })
      expect(result.submitterAmount).toBe(0)
      expect(result.nonprofitAmount).toBe(100)
    })

    it('should handle fractional amounts correctly', () => {
      const result = calculateTipSplitAmounts(0.05, { submitterPercent: 70, nonprofitPercent: 30 })
      expect(result.submitterAmount).toBeCloseTo(0.035)
      expect(result.nonprofitAmount).toBeCloseTo(0.015)
    })

    it('should ensure amounts total original', () => {
      const total = 123.456
      const result = calculateTipSplitAmounts(total, { submitterPercent: 33, nonprofitPercent: 67 })
      expect(result.submitterAmount + result.nonprofitAmount).toBeCloseTo(total)
    })

    it('should throw on invalid split', () => {
      expect(() => calculateTipSplitAmounts(100, { submitterPercent: 70, nonprofitPercent: 40 }))
        .toThrow('Percentages must total 100')
    })
  })

  describe('validateMainnetDistribution', () => {
    const testnetBalance: CampaignBalance = {
      campaignId: 'test-123',
      title: 'Test Campaign',
      status: 'minted',
      chainId: 11155111,
      chainName: 'Sepolia',
      isTestnet: true,
      contractVersion: 'V7',
      immediatePayoutEnabled: false,
      submitterWallet: '0x5204Be8eFd63CddFBc1a5C81E3E206e9b57b4dd9',
      nonprofitWallet: null,
      tipSplitSubmitterPct: 100,
      tipSplitNonprofitPct: 0,
      grossRaisedUsd: 0,
      grossRaisedNative: 0,
      tipsReceivedUsd: 0,
      tipsReceivedNative: 0,
      totalDistributed: 0,
      tipsDistributed: 0,
      lastDistributionAt: null,
      pendingDistributionNative: 0,
      pendingTipsNative: 0,
      nativeCurrency: 'ETH',
      distributionCount: 0
    }

    const mainnetBalance: CampaignBalance = {
      ...testnetBalance,
      chainId: 1,
      chainName: 'Ethereum',
      isTestnet: false
    }

    it('should allow testnet distributions without confirmation', () => {
      expect(validateMainnetDistribution(testnetBalance, false)).toEqual({ valid: true })
    })

    it('should require confirmation for mainnet', () => {
      expect(validateMainnetDistribution(mainnetBalance, false).valid).toBe(false)
      expect(validateMainnetDistribution(mainnetBalance, false).error).toContain('REAL MONEY')
    })

    it('should allow mainnet with confirmation', () => {
      expect(validateMainnetDistribution(mainnetBalance, true)).toEqual({ valid: true })
    })
  })
})
