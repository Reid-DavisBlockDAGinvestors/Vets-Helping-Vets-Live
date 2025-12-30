'use client'

/**
 * ProgressMilestone Component
 * 
 * Psychology: Goal Gradient Effect
 * - People accelerate effort as they approach a goal
 * - Visual milestones create dopamine hits
 * - Celebration creates positive association with giving
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfetti } from '@/hooks/useConfetti'

interface Milestone {
  percent: number
  label: string
  emoji: string
  message: string
}

const MILESTONES: Milestone[] = [
  { percent: 25, label: '25%', emoji: '🌟', message: 'Great start! Momentum is building!' },
  { percent: 50, label: '50%', emoji: '🔥', message: 'Halfway there! Keep the fire burning!' },
  { percent: 75, label: '75%', emoji: '🚀', message: 'Almost there! The finish line is in sight!' },
  { percent: 100, label: '100%', emoji: '🎉', message: 'GOAL REACHED! Thank you heroes!' },
]

interface ProgressMilestoneProps {
  currentPercent: number
  goalAmount: number
  raisedAmount: number
  showCelebration?: boolean
}

export function ProgressMilestone({
  currentPercent,
  goalAmount,
  raisedAmount,
  showCelebration = true,
}: ProgressMilestoneProps) {
  const [celebratingMilestone, setCelebratingMilestone] = useState<Milestone | null>(null)
  const [achievedMilestones, setAchievedMilestones] = useState<number[]>([])
  const { firePurchaseSuccess } = useConfetti()

  // Check for newly achieved milestones
  useEffect(() => {
    const newlyAchieved = MILESTONES.filter(
      m => currentPercent >= m.percent && !achievedMilestones.includes(m.percent)
    )

    if (newlyAchieved.length > 0 && showCelebration) {
      const latestMilestone = newlyAchieved[newlyAchieved.length - 1]
      setCelebratingMilestone(latestMilestone)
      firePurchaseSuccess()

      setAchievedMilestones(prev => [
        ...prev,
        ...newlyAchieved.map(m => m.percent)
      ])

      // Clear celebration after 5 seconds
      setTimeout(() => setCelebratingMilestone(null), 5000)
    }
  }, [currentPercent, achievedMilestones, showCelebration, firePurchaseSuccess])

  const nextMilestone = MILESTONES.find(m => m.percent > currentPercent) || MILESTONES[MILESTONES.length - 1]
  const amountToNextMilestone = (nextMilestone.percent / 100 * goalAmount) - raisedAmount

  return (
    <div className="relative" data-testid="progress-milestone">
      {/* Milestone Celebration Overlay */}
      <AnimatePresence>
        {celebratingMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 rounded-xl"
          >
            <div className="text-center p-6">
              <motion.span
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
                className="text-6xl block mb-4"
              >
                {celebratingMilestone.emoji}
              </motion.span>
              <h3 className="text-2xl font-bold text-white mb-2">
                {celebratingMilestone.label} Milestone Reached!
              </h3>
              <p className="text-white/70">{celebratingMilestone.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar with Milestones */}
      <div className="mb-4">
        <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(currentPercent, 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
          />
          
          {/* Milestone Markers */}
          {MILESTONES.slice(0, -1).map((milestone) => (
            <div
              key={milestone.percent}
              className="absolute top-0 h-full w-1 bg-white/30"
              style={{ left: `${milestone.percent}%` }}
            >
              <span
                className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs ${
                  currentPercent >= milestone.percent ? 'text-green-400' : 'text-white/40'
                }`}
              >
                {milestone.emoji}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Next Milestone Encouragement */}
      {currentPercent < 100 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-white/60">
            {currentPercent.toFixed(0)}% of goal reached
          </span>
          <span className="text-emerald-400 font-medium">
            ${amountToNextMilestone.toLocaleString(undefined, { maximumFractionDigits: 0 })} to {nextMilestone.emoji} {nextMilestone.label}
          </span>
        </div>
      )}

      {/* Goal Reached Message */}
      {currentPercent >= 100 && (
        <div className="text-center py-2">
          <span className="text-green-400 font-bold">
            🎉 Goal Reached! Every additional dollar helps even more! 🎉
          </span>
        </div>
      )}
    </div>
  )
}

export default ProgressMilestone
