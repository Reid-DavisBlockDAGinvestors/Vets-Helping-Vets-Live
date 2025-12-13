'use client'

import Link from 'next/link'
import { ipfsToHttp } from '@/lib/ipfs'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'
const EXPLORER_URL = 'https://awakening.bdagscan.com'

export type NFTItem = {
  id: string
  campaignId?: number // V5: campaign ID for story page link
  title: string
  image: string
  causeType: 'veteran' | 'general'
  location?: string
  urgency?: 'low' | 'medium' | 'high'
  progress: number
  goal: number
  raised: number
  nftSalesUSD?: number
  tipsUSD?: number
  snippet: string
  sold?: number
  total?: number
  remaining?: number | null // null = unlimited
  // Living NFT update info
  updateCount?: number
  lastUpdated?: string | null
  hasRecentUpdate?: boolean
}

export default function NFTCard({ item }: { item: NFTItem }) {
  // Use edition-based progress (sold/total) when available, otherwise raised/goal
  const pct = (item.total && item.total > 0 && item.sold !== undefined)
    ? Math.min(100, Math.round((item.sold / item.total) * 100))
    : (item.progress !== undefined ? item.progress : Math.min(100, Math.round((item.raised / Math.max(1, item.goal)) * 100)))
  const maxLen = 120
  const snippet = item.snippet.length > maxLen
    ? item.snippet.slice(0, maxLen).trimEnd() + '...'
    : item.snippet

  return (
    <Link href={`/story/${item.campaignId ?? item.id}`} className="group block">
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:shadow-xl hover:shadow-blue-900/20 hover:-translate-y-1">
        {/* Image Container */}
        <div className="relative h-52 overflow-hidden">
          {item.image ? (
            <img 
              src={ipfsToHttp(item.image)} 
              alt={item.title} 
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-900/50 to-purple-900/50 flex items-center justify-center">
              <span className="text-4xl opacity-30">🎖️</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Top Badges Row */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            {/* Series Badge - Left Side */}
            <div className="flex flex-col gap-1.5">
              {/* Edition/Series counter */}
              <span className="rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur-sm bg-black/50 text-white border border-white/20">
                {item.sold !== undefined && item.total && item.total > 0 
                  ? `${item.sold}/${item.total} sold`
                  : item.sold !== undefined 
                    ? `${item.sold} sold`
                    : '0 sold'
                }
              </span>
              {item.updateCount && item.updateCount > 0 && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm flex items-center gap-1 ${
                  item.hasRecentUpdate 
                    ? 'bg-green-500/30 text-green-200 border border-green-500/30 animate-pulse' 
                    : 'bg-purple-500/30 text-purple-200 border border-purple-500/30'
                }`}>
                  <span>📢</span>
                  <span>{item.updateCount} update{item.updateCount !== 1 ? 's' : ''}</span>
                </span>
              )}
              {item.hasRecentUpdate && (
                <span className="rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm bg-yellow-500/30 text-yellow-200 border border-yellow-500/30">
                  🔥 Recently Updated
                </span>
              )}
            </div>
            
            {/* Category Badge - Right Side */}
            <span className={`rounded-full px-3 py-1 text-xs font-medium backdrop-blur-sm ${
              item.causeType === 'veteran' 
                ? 'bg-red-500/30 text-red-200 border border-red-500/30' 
                : 'bg-blue-500/30 text-blue-200 border border-blue-500/30'
            }`}>
              {item.causeType === 'veteran' ? 'Veteran' : 'General'}
            </span>
          </div>

          {/* Progress Overlay */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex justify-between text-xs text-white mb-1">
              <div className="flex flex-col">
                <span className="font-semibold">${item.raised.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                {item.raised > 0 && (
                  <div className="flex gap-2 text-[10px] opacity-80">
                    <span className="text-emerald-300">NFT: ${(item.nftSalesUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    <span className="text-purple-300">Tips: ${(item.tipsUSD || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                )}
              </div>
              <span className="opacity-70">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500" 
                style={{ width: `${pct}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-semibold text-lg text-white group-hover:text-blue-300 transition-colors line-clamp-1">
            {item.title}
          </h3>
          {snippet && (
            <p className="mt-2 text-sm text-white/60 line-clamp-2">{snippet}</p>
          )}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-white/50">
              Goal: <span className="text-white/80">${item.goal.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`${EXPLORER_URL}/address/${CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                title="View on blockchain"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <span className="text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors flex items-center gap-1">
                View Story
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
