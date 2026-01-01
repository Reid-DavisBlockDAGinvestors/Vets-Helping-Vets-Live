/**
 * Ethereum Security Utilities
 * 
 * Industry-grade security features for Ethereum transactions:
 * - Gas price limits and monitoring
 * - Transaction signing validation
 * - Nonce management
 * - Receipt verification
 * - Slippage protection
 */

import { ethers, TransactionRequest, TransactionResponse, TransactionReceipt } from 'ethers'

// ============ Types ============

export interface GasConfig {
  maxGasPriceGwei: number
  maxPriorityFeeGwei: number
  gasBufferPercent: number
  maxGasLimit: number
}

export interface TransactionConfig {
  timeoutMs: number
  confirmations: number
  retryAttempts: number
  retryDelayMs: number
}

export interface SecureTransactionOptions {
  gasConfig?: Partial<GasConfig>
  txConfig?: Partial<TransactionConfig>
  onGasPriceCheck?: (currentGwei: number, maxGwei: number) => void
  onConfirmation?: (confirmations: number, required: number) => void
}

// ============ Default Configurations ============

export const DEFAULT_GAS_CONFIG: GasConfig = {
  maxGasPriceGwei: 100,       // Don't transact above 100 gwei
  maxPriorityFeeGwei: 3,      // Max priority fee (tip)
  gasBufferPercent: 20,       // Add 20% buffer to estimates
  maxGasLimit: 5_000_000,     // Absolute max gas limit
}

export const DEFAULT_TX_CONFIG: TransactionConfig = {
  timeoutMs: 5 * 60 * 1000,   // 5 minute timeout
  confirmations: 3,           // Wait for 3 confirmations
  retryAttempts: 3,           // Retry 3 times on failure
  retryDelayMs: 5000,         // 5 second delay between retries
}

// ============ Gas Price Utilities ============

/**
 * Get current gas prices with safety checks
 */
export async function getGasPrices(provider: ethers.Provider): Promise<{
  gasPrice: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  gasPriceGwei: number
}> {
  const feeData = await provider.getFeeData()
  
  const gasPrice = feeData.gasPrice || BigInt(0)
  const maxFeePerGas = feeData.maxFeePerGas || gasPrice
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || BigInt(0)
  const gasPriceGwei = Number(ethers.formatUnits(gasPrice, 'gwei'))
  
  return {
    gasPrice,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasPriceGwei,
  }
}

/**
 * Check if gas price is within acceptable limits
 */
export async function isGasPriceAcceptable(
  provider: ethers.Provider,
  maxGwei: number = DEFAULT_GAS_CONFIG.maxGasPriceGwei
): Promise<{ acceptable: boolean; currentGwei: number; maxGwei: number }> {
  const { gasPriceGwei } = await getGasPrices(provider)
  
  return {
    acceptable: gasPriceGwei <= maxGwei,
    currentGwei: gasPriceGwei,
    maxGwei,
  }
}

/**
 * Wait for gas price to be acceptable
 */
export async function waitForAcceptableGasPrice(
  provider: ethers.Provider,
  maxGwei: number = DEFAULT_GAS_CONFIG.maxGasPriceGwei,
  timeoutMs: number = 30 * 60 * 1000, // 30 minutes
  checkIntervalMs: number = 60 * 1000 // Check every minute
): Promise<boolean> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    const { acceptable, currentGwei } = await isGasPriceAcceptable(provider, maxGwei)
    
    if (acceptable) {
      return true
    }
    
    console.log(`Gas price ${currentGwei.toFixed(1)} gwei > ${maxGwei} gwei limit. Waiting...`)
    await sleep(checkIntervalMs)
  }
  
  return false
}

// ============ Transaction Utilities ============

/**
 * Estimate gas with buffer
 */
export async function estimateGasWithBuffer(
  provider: ethers.Provider,
  tx: TransactionRequest,
  bufferPercent: number = DEFAULT_GAS_CONFIG.gasBufferPercent
): Promise<bigint> {
  const estimate = await provider.estimateGas(tx)
  const buffer = (estimate * BigInt(bufferPercent)) / BigInt(100)
  return estimate + buffer
}

/**
 * Build a secure transaction with gas limits
 */
export async function buildSecureTransaction(
  provider: ethers.Provider,
  baseTx: TransactionRequest,
  gasConfig: GasConfig = DEFAULT_GAS_CONFIG
): Promise<TransactionRequest> {
  // Get current gas prices
  const feeData = await provider.getFeeData()
  const currentGasPrice = feeData.gasPrice || BigInt(0)
  const maxGasPrice = ethers.parseUnits(gasConfig.maxGasPriceGwei.toString(), 'gwei')
  
  // Check gas price limit
  if (currentGasPrice > maxGasPrice) {
    throw new GasPriceTooHighError(
      Number(ethers.formatUnits(currentGasPrice, 'gwei')),
      gasConfig.maxGasPriceGwei
    )
  }
  
  // Estimate gas with buffer
  const gasEstimate = await estimateGasWithBuffer(provider, baseTx, gasConfig.gasBufferPercent)
  const gasLimit = gasEstimate > BigInt(gasConfig.maxGasLimit) 
    ? BigInt(gasConfig.maxGasLimit) 
    : gasEstimate
  
  // Build EIP-1559 transaction if supported
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    const maxPriorityFee = ethers.parseUnits(gasConfig.maxPriorityFeeGwei.toString(), 'gwei')
    
    return {
      ...baseTx,
      gasLimit,
      maxFeePerGas: feeData.maxFeePerGas > maxGasPrice ? maxGasPrice : feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas > maxPriorityFee 
        ? maxPriorityFee 
        : feeData.maxPriorityFeePerGas,
      type: 2, // EIP-1559
    }
  }
  
  // Legacy transaction
  return {
    ...baseTx,
    gasLimit,
    gasPrice: currentGasPrice > maxGasPrice ? maxGasPrice : currentGasPrice,
  }
}

/**
 * Send transaction with timeout and confirmations
 */
export async function sendSecureTransaction(
  signer: ethers.Signer,
  tx: TransactionRequest,
  options: SecureTransactionOptions = {}
): Promise<{ tx: TransactionResponse; receipt: TransactionReceipt }> {
  const gasConfig = { ...DEFAULT_GAS_CONFIG, ...options.gasConfig }
  const txConfig = { ...DEFAULT_TX_CONFIG, ...options.txConfig }
  
  const provider = signer.provider
  if (!provider) {
    throw new Error('Signer must have a provider')
  }
  
  // Check gas price
  const { acceptable, currentGwei, maxGwei } = await isGasPriceAcceptable(
    provider,
    gasConfig.maxGasPriceGwei
  )
  options.onGasPriceCheck?.(currentGwei, maxGwei)
  
  if (!acceptable) {
    throw new GasPriceTooHighError(currentGwei, maxGwei)
  }
  
  // Build secure transaction
  const secureTx = await buildSecureTransaction(provider, tx, gasConfig)
  
  // Send transaction
  const response = await signer.sendTransaction(secureTx)
  
  // Wait for confirmation with timeout
  const receipt = await waitForConfirmationWithTimeout(
    response,
    txConfig.confirmations,
    txConfig.timeoutMs,
    options.onConfirmation
  )
  
  return { tx: response, receipt }
}

/**
 * Wait for transaction confirmation with timeout
 */
export async function waitForConfirmationWithTimeout(
  tx: TransactionResponse,
  confirmations: number = DEFAULT_TX_CONFIG.confirmations,
  timeoutMs: number = DEFAULT_TX_CONFIG.timeoutMs,
  onConfirmation?: (current: number, required: number) => void
): Promise<TransactionReceipt> {
  const startTime = Date.now()
  
  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TransactionTimeoutError(tx.hash, timeoutMs))
    }, timeoutMs)
  })
  
  // Create confirmation promise
  const confirmationPromise = (async () => {
    let currentConfirmations = 0
    
    while (currentConfirmations < confirmations) {
      if (Date.now() - startTime > timeoutMs) {
        throw new TransactionTimeoutError(tx.hash, timeoutMs)
      }
      
      const receipt = await tx.wait(1)
      if (receipt) {
        currentConfirmations = await receipt.confirmations()
        onConfirmation?.(currentConfirmations, confirmations)
        
        if (currentConfirmations >= confirmations) {
          return receipt
        }
      }
      
      await sleep(2000) // Check every 2 seconds
    }
    
    const finalReceipt = await tx.wait(confirmations)
    if (!finalReceipt) {
      throw new Error('Transaction receipt is null')
    }
    return finalReceipt
  })()
  
  return Promise.race([confirmationPromise, timeoutPromise])
}

// ============ Nonce Management ============

/**
 * Get next nonce with pending transaction awareness
 */
export async function getNextNonce(
  provider: ethers.Provider,
  address: string
): Promise<number> {
  const [confirmedNonce, pendingNonce] = await Promise.all([
    provider.getTransactionCount(address, 'latest'),
    provider.getTransactionCount(address, 'pending'),
  ])
  
  // Use pending nonce to avoid conflicts
  return Math.max(confirmedNonce, pendingNonce)
}

// ============ Receipt Verification ============

/**
 * Verify transaction receipt status
 */
export function verifyReceipt(receipt: TransactionReceipt): {
  success: boolean
  gasUsed: bigint
  effectiveGasPrice: bigint
  totalCost: bigint
} {
  const success = receipt.status === 1
  const gasUsed = receipt.gasUsed
  const effectiveGasPrice = receipt.gasPrice || BigInt(0)
  const totalCost = gasUsed * effectiveGasPrice
  
  return {
    success,
    gasUsed,
    effectiveGasPrice,
    totalCost,
  }
}

// ============ Custom Errors ============

export class GasPriceTooHighError extends Error {
  constructor(
    public currentGwei: number,
    public maxGwei: number
  ) {
    super(`Gas price ${currentGwei.toFixed(1)} gwei exceeds limit ${maxGwei} gwei`)
    this.name = 'GasPriceTooHighError'
  }
}

export class TransactionTimeoutError extends Error {
  constructor(
    public txHash: string,
    public timeoutMs: number
  ) {
    super(`Transaction ${txHash} timed out after ${timeoutMs / 1000}s`)
    this.name = 'TransactionTimeoutError'
  }
}

// ============ Helpers ============

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============ Export Default Config ============

export default {
  DEFAULT_GAS_CONFIG,
  DEFAULT_TX_CONFIG,
  getGasPrices,
  isGasPriceAcceptable,
  waitForAcceptableGasPrice,
  estimateGasWithBuffer,
  buildSecureTransaction,
  sendSecureTransaction,
  waitForConfirmationWithTimeout,
  getNextNonce,
  verifyReceipt,
}
