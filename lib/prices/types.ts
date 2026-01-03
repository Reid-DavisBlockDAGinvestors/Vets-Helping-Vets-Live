/**
 * Price Feed Types
 * 
 * Supports multi-chain price feeds for USD conversion
 */

export type PriceSource = 'chainlink' | 'coingecko' | 'pyth' | 'dex' | 'fallback'

export interface PriceData {
  symbol: string           // "ETH", "BTC", "SOL"
  priceUsd: number         // 3100.50
  change24h?: number       // -2.5 (percentage)
  lastUpdated: number      // Unix timestamp ms
  source: PriceSource      // Where the price came from
  confidence?: number      // 0-1 confidence score
}

export interface ConversionResult {
  fromUsd: number          // Input USD amount
  toCurrency: string       // Target currency symbol
  amount: string           // Native currency amount (string for precision)
  amountWei: string        // Amount in smallest unit (wei/lamports/satoshi)
  rate: number             // USD rate used
  source: PriceSource      // Price source
  timestamp: number        // When conversion was made
}

export interface PriceError {
  code: 'FETCH_FAILED' | 'RATE_LIMITED' | 'INVALID_RESPONSE' | 'TIMEOUT' | 'NO_PRICE'
  source: PriceSource
  message: string
  retryAfter?: number      // seconds
}

// CoinGecko ID mapping
export const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  MATIC: 'matic-network',
  BNB: 'binancecoin',
  AVAX: 'avalanche-2',
  XRP: 'ripple',
  LINK: 'chainlink',
  DOT: 'polkadot',
  ADA: 'cardano',
  ATOM: 'cosmos',
  // BDAG not listed yet - use fallback
}

// Chain ID to native currency mapping
export const CHAIN_CURRENCIES: Record<number, string> = {
  1: 'ETH',           // Ethereum Mainnet
  11155111: 'ETH',    // Sepolia Testnet
  137: 'MATIC',       // Polygon
  80001: 'MATIC',     // Polygon Mumbai
  56: 'BNB',          // BNB Chain
  97: 'BNB',          // BNB Testnet
  43114: 'AVAX',      // Avalanche C-Chain
  43113: 'AVAX',      // Avalanche Fuji
  42161: 'ETH',       // Arbitrum One
  421614: 'ETH',      // Arbitrum Sepolia
  10: 'ETH',          // Optimism
  11155420: 'ETH',    // Optimism Sepolia
  8453: 'ETH',        // Base
  84532: 'ETH',       // Base Sepolia
  1043: 'BDAG',       // BlockDAG Testnet
}

// Currency decimals (for wei conversion)
export const CURRENCY_DECIMALS: Record<string, number> = {
  ETH: 18,
  BTC: 8,
  SOL: 9,
  MATIC: 18,
  BNB: 18,
  AVAX: 18,
  XRP: 6,
  BDAG: 18,
}

// Testnet chains that should use mainnet prices
export const TESTNET_TO_MAINNET: Record<number, number> = {
  11155111: 1,        // Sepolia -> Ethereum
  80001: 137,         // Mumbai -> Polygon
  97: 56,             // BNB Testnet -> BNB
  43113: 43114,       // Fuji -> Avalanche
  421614: 42161,      // Arbitrum Sepolia -> Arbitrum
  11155420: 10,       // Optimism Sepolia -> Optimism
  84532: 8453,        // Base Sepolia -> Base
}

// Environment variable fallback rates
export const FALLBACK_RATES: Record<string, number> = {
  ETH: parseFloat(process.env.ETH_USD_RATE || '3100'),
  BTC: parseFloat(process.env.BTC_USD_RATE || '95000'),
  SOL: parseFloat(process.env.SOL_USD_RATE || '180'),
  MATIC: parseFloat(process.env.MATIC_USD_RATE || '0.85'),
  BNB: parseFloat(process.env.BNB_USD_RATE || '680'),
  AVAX: parseFloat(process.env.AVAX_USD_RATE || '35'),
  XRP: parseFloat(process.env.XRP_USD_RATE || '2.20'),
  BDAG: parseFloat(process.env.BDAG_USD_RATE || '0.05'),
}

// Cache TTLs
export const CACHE_TTL = {
  DISPLAY: 60_000,      // 60 seconds for UI display
  PURCHASE: 30_000,     // 30 seconds for purchase calculations  
  ADMIN: 300_000,       // 5 minutes for admin dashboard
}
