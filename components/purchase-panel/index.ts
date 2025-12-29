/**
 * PurchasePanel Module
 * 
 * Modular structure for NFT/donation purchase flow
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Price calculations and config
 */

// Types
export * from './types'

// Hooks
export { usePurchaseConfig, usdToBdag, bdagToUsd, BDAG_USD_PRICE } from './hooks'
