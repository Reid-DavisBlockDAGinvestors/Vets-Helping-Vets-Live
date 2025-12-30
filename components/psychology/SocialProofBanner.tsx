'use client'

/**
 * SocialProofBanner Component
 * 
 * Psychology: Social Proof & Bandwagon Effect
 * - People follow others' actions
 * - Numbers create legitimacy
 * - Recent activity creates urgency
 */

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface SocialProofBannerProps {
  totalDonors?: number
  totalRaised?: number
  recentDonorName?: string
  recentAmount?: number
  className?: string
}

const ROTATING_MESSAGES = [
  { icon: '👥', text: (n: number) => `${n.toLocaleString()} people have donated` },
  { icon: '💰', text: (n: number) => `$${n.toLocaleString()} raised for veterans` },
  { icon: '🇺🇸', text: () => 'Join thousands supporting our heroes' },
  { icon: '❤️', text: () => 'Every dollar makes a difference' },
]

export function SocialProofBanner({
  totalDonors = 0,
  totalRaised = 0,
  recentDonorName,
  recentAmount,
  className = '',
}: SocialProofBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showRecentDonation, setShowRecentDonation] = useState(false)

  // Rotate through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % ROTATING_MESSAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Show recent donation notification
  useEffect(() => {
    if (recentDonorName && recentAmount) {
      setShowRecentDonation(true)
      const timer = setTimeout(() => setShowRecentDonation(false), 8000)
      return () => clearTimeout(timer)
    }
  }, [recentDonorName, recentAmount])

  const currentMessage = ROTATING_MESSAGES[currentIndex]

  return (
    <div className={`relative ${className}`} data-testid="social-proof-banner">
      {/* Main Banner */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-white/10 rounded-lg p-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2 text-sm"
          >
            <span className="text-lg">{currentMessage.icon}</span>
            <span className="text-white/80">
              {currentMessage.text(currentIndex === 0 ? totalDonors : totalRaised)}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Recent Donation Toast */}
      <AnimatePresence>
        {showRecentDonation && recentDonorName && recentAmount && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="absolute -bottom-16 right-0 bg-green-500/20 border border-green-500/30 rounded-lg p-3 min-w-[200px]"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">🎉</span>
              <div>
                <p className="text-green-400 text-sm font-medium">
                  {recentDonorName} just donated!
                </p>
                <p className="text-white font-bold">
                  ${recentAmount.toLocaleString()}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SocialProofBanner
