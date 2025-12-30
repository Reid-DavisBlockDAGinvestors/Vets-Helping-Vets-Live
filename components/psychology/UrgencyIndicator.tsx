'use client'

/**
 * UrgencyIndicator Component
 * 
 * Psychology: Scarcity & Urgency
 * - Limited availability increases desire
 * - Countdown creates FOMO
 * - Near-completion triggers action
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface UrgencyIndicatorProps {
  remainingNfts?: number | null
  totalNfts?: number
  percentFunded?: number
  endDate?: string | null
  className?: string
}

function getTimeRemaining(endDate: string): { days: number; hours: number; minutes: number } | null {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const diff = end - now

  if (diff <= 0) return null

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
  }
}

export function UrgencyIndicator({
  remainingNfts,
  totalNfts,
  percentFunded = 0,
  endDate,
  className = '',
}: UrgencyIndicatorProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number } | null>(null)

  // Update countdown
  useEffect(() => {
    if (!endDate) return

    const updateTime = () => {
      setTimeLeft(getTimeRemaining(endDate))
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [endDate])

  // Determine urgency level
  const getUrgencyLevel = () => {
    if (remainingNfts !== null && remainingNfts !== undefined && remainingNfts <= 5) return 'critical'
    if (percentFunded >= 90) return 'high'
    if (timeLeft && timeLeft.days <= 3) return 'high'
    if (remainingNfts !== null && remainingNfts !== undefined && totalNfts && remainingNfts / totalNfts <= 0.1) return 'high'
    if (percentFunded >= 75) return 'medium'
    return 'low'
  }

  const urgencyLevel = getUrgencyLevel()

  // Don't show if no urgency
  if (urgencyLevel === 'low') return null

  const urgencyStyles = {
    critical: 'bg-red-500/20 border-red-500/50 text-red-400',
    high: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    medium: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    low: '',
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-lg border p-3 ${urgencyStyles[urgencyLevel]} ${className}`}
      data-testid="urgency-indicator"
    >
      <div className="flex items-center gap-3">
        {/* Pulsing indicator */}
        <motion.span
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-xl"
        >
          {urgencyLevel === 'critical' ? '🔥' : urgencyLevel === 'high' ? '⚡' : '⏰'}
        </motion.span>

        <div className="flex-1">
          {/* NFT Scarcity */}
          {remainingNfts !== null && remainingNfts !== undefined && remainingNfts <= 10 && (
            <p className="font-semibold">
              Only {remainingNfts} NFT{remainingNfts !== 1 ? 's' : ''} left!
            </p>
          )}

          {/* Near Goal */}
          {percentFunded >= 90 && percentFunded < 100 && (
            <p className="font-semibold">
              {(100 - percentFunded).toFixed(0)}% away from goal!
            </p>
          )}

          {/* Countdown */}
          {timeLeft && (
            <p className="text-sm opacity-80">
              {timeLeft.days > 0 && `${timeLeft.days}d `}
              {timeLeft.hours}h {timeLeft.minutes}m remaining
            </p>
          )}

          {/* Goal reached */}
          {percentFunded >= 100 && (
            <p className="font-semibold text-green-400">
              🎉 Goal reached! Help them go further!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default UrgencyIndicator
