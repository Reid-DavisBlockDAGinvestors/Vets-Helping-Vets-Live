/**
 * Purchase Module
 * 
 * Refactored from the monolithic PurchasePanel.tsx (46KB, 1004 lines)
 * into a modular structure following ISP and Strategy pattern.
 * 
 * Structure:
 * - types.ts - All TypeScript interfaces and payment strategy types
 * - hooks/ - Purchase state, crypto payment logic
 * - QuantitySelector.tsx - NFT quantity input
 * - TipSelector.tsx - Tip amount selector
 * - PaymentTabs.tsx - Payment method tabs
 * - PurchaseSuccess.tsx - Success display with NFT import instructions
 * 
 * Usage:
 * ```typescript
 * import { usePurchaseState, QuantitySelector, PaymentTabs } from '@/components/purchase'
 * ```
 */

// Types
export * from './types'

// Hooks
export { usePurchaseState, useCryptoPayment } from './hooks'
export type { UsePurchaseStateReturn } from './hooks'

// Components
export { QuantitySelector } from './QuantitySelector'
export { TipSelector } from './TipSelector'
export { PaymentTabs } from './PaymentTabs'
export { PurchaseSuccess } from './PurchaseSuccess'
