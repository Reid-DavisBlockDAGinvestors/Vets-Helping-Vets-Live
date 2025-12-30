'use client'

/**
 * SuccessMessage Component
 * 
 * Displays purchase success with NFT details
 * Following ISP - focused on success display only
 */

import type { PurchaseResult } from './types'

export interface SuccessMessageProps {
  result: PurchaseResult
  contractAddress: string
}

export function SuccessMessage({ result, contractAddress }: SuccessMessageProps) {
  if (!result.success) return null

  return (
    <div 
      className="rounded-lg bg-green-500/20 border border-green-500/30 p-4 space-y-3"
      data-testid="purchase-success-message"
    >
      <div className="text-center">
        <p className="text-green-400 font-semibold">Thank you for your donation!</p>
      </div>
      
      {result.mintedTokenIds && result.mintedTokenIds.length > 0 && (
        <div className="bg-white/5 rounded-lg p-3 space-y-2" data-testid="nft-details">
          <p className="text-sm text-white/80 font-medium">
            Your NFT{result.mintedTokenIds.length > 1 ? 's' : ''}:
          </p>
          <div className="flex flex-wrap gap-2">
            {result.mintedTokenIds.map((tid: number) => (
              <span 
                key={tid} 
                className="px-3 py-1 bg-green-500/20 rounded-full text-green-400 text-sm font-mono"
                data-testid={`token-badge-${tid}`}
              >
                Token #{tid}
              </span>
            ))}
          </div>
          <div className="pt-2 border-t border-white/10 mt-2">
            <p className="text-xs text-white/60 mb-2">To view in MetaMask:</p>
            <ol className="text-xs text-white/50 space-y-1 list-decimal list-inside">
              <li>Open MetaMask → NFTs tab</li>
              <li>Click "Import NFT"</li>
              <li>
                Contract: <span className="font-mono text-white/70">
                  {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </span>
              </li>
              <li>
                Token ID: <span className="font-mono text-green-400">
                  {result.mintedTokenIds[result.mintedTokenIds.length - 1]}
                </span>
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
