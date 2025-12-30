/**
 * PurchasePanel Module
 * 
 * Modular structure for NFT/donation purchase flow
 * Following ISP principles - small, focused components
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces
 * - hooks/ - Price calculations, auth, and purchase logic
 * - CardPaymentForm.tsx - Stripe card payment UI
 * - CryptoPaymentSection.tsx - BDAG crypto payment UI
 * - SuccessMessage.tsx - Purchase success display
 */

// Types
export * from './types'

// Hooks
export { 
  usePurchaseConfig, 
  usdToBdag, 
  bdagToUsd, 
  BDAG_USD_PRICE,
  usePurchaseAuth,
  useBdagPurchase
} from './hooks'

// Components
export { CardPaymentForm } from './CardPaymentForm'
export { CryptoPaymentSection } from './CryptoPaymentSection'
export { SuccessMessage } from './SuccessMessage'
