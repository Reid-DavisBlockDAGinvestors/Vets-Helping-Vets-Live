'use client'

/**
 * LiveDonationFeed Component
 * 
 * Real-time donation ticker with psychological engagement
 * - Social proof: "Others are donating right now"
 * - Urgency: Live updates create momentum
 * - Gamification: Running total and counter
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtimeDonations, RealtimeDonation } from '@/hooks/useRealtimeDonations'
import { useConfetti } from '@/hooks/useConfetti'

interface LiveDonationFeedProps {
  campaignId?: number
  showTotal?: boolean
  compact?: boolean
  className?: string
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function anonymizeDonor(name?: string): string {
  if (!name) return 'Anonymous Hero'
  if (name.includes('@')) {
    const [local] = name.split('@')
    return `${local.slice(0, 2)}***`
  }
  if (name.startsWith('0x')) {
    return `${name.slice(0, 6)}...${name.slice(-4)}`
  }
  return name.length > 2 ? `${name.slice(0, 2)}***` : 'Supporter'
}

export function LiveDonationFeed({
  campaignId,
  showTotal = true,
  compact = false,
  className = '',
}: LiveDonationFeedProps) {
  const { fireCenterBurst } = useConfetti()
  const [showCelebration, setShowCelebration] = useState(false)

  const handleNewDonation = (donation: RealtimeDonation) => {
    // Trigger confetti for larger donations
    if (donation.amount_usd >= 50) {
      fireCenterBurst({ particleCount: 50 })
    }
    setShowCelebration(true)
    setTimeout(() => setShowCelebration(false), 3000)
  }

  const { stats, isConnected } = useRealtimeDonations({
    campaignId,
    onNewDonation: handleNewDonation,
  })

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="live-donation-feed-compact">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
        <span className="text-sm text-white/70">
          {stats.donationCount > 0 
            ? `${stats.donationCount} donation${stats.donationCount !== 1 ? 's' : ''} today`
            : 'Live updates'
          }
        </span>
      </div>
    )
  }

  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 p-4 ${className}`} data-testid="live-donation-feed">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
          <h3 className="text-sm font-semibold text-white">Live Activity</h3>
        </div>
        {showTotal && stats.totalRaised > 0 && (
          <motion.div
            key={stats.totalRaised}
            initial={{ scale: 1.2, color: '#22c55e' }}
            animate={{ scale: 1, color: '#ffffff' }}
            className="text-lg font-bold"
          >
            ${stats.totalRaised.toLocaleString()}
          </motion.div>
        )}
      </div>

      {/* New Donation Celebration */}
      <AnimatePresence>
        {showCelebration && stats.lastDonation && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 p-3 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <p className="text-green-400 font-semibold">
                  {anonymizeDonor(stats.lastDonation.donor_name)} just donated!
                </p>
                <p className="text-white text-lg font-bold">
                  ${stats.lastDonation.amount_usd.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Donations List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {stats.recentDonations.length === 0 ? (
          <p className="text-center text-white/50 text-sm py-4">
            Waiting for donations...
          </p>
        ) : (
          stats.recentDonations.map((donation, index) => (
            <motion.div
              key={donation.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {anonymizeDonor(donation.donor_name).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">
                    {anonymizeDonor(donation.donor_name)}
                  </p>
                  <p className="text-xs text-white/50">
                    {formatTimeAgo(donation.created_at)}
                  </p>
                </div>
              </div>
              <p className="text-green-400 font-semibold">
                +${donation.amount_usd.toLocaleString()}
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Social Proof Footer */}
      {stats.donationCount > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10 text-center">
          <p className="text-sm text-white/60">
            <span className="text-white font-semibold">{stats.donationCount}</span> people have donated
          </p>
        </div>
      )}
    </div>
  )
}

export default LiveDonationFeed
