'use client'

/**
 * useConfetti Hook
 * Triggers celebratory confetti animation on purchase success
 * Following ISP - focused on confetti functionality only
 */

import { useCallback } from 'react'
import confetti from 'canvas-confetti'

interface ConfettiOptions {
  /** Duration of confetti in milliseconds */
  duration?: number
  /** Number of confetti particles */
  particleCount?: number
  /** Spread angle of confetti */
  spread?: number
  /** Starting angle of confetti */
  startVelocity?: number
  /** Colors of confetti particles */
  colors?: string[]
}

const defaultOptions: ConfettiOptions = {
  duration: 3000,
  particleCount: 100,
  spread: 70,
  startVelocity: 30,
  colors: ['#ff0000', '#ffffff', '#0000ff', '#ffd700', '#00ff00'], // Patriotic + gold
}

export function useConfetti() {
  /**
   * Fire a burst of confetti from the center
   */
  const fireCenterBurst = useCallback((options: ConfettiOptions = {}) => {
    const opts = { ...defaultOptions, ...options }
    
    confetti({
      particleCount: opts.particleCount,
      spread: opts.spread,
      startVelocity: opts.startVelocity,
      colors: opts.colors,
      origin: { x: 0.5, y: 0.5 },
    })
  }, [])

  /**
   * Fire confetti from both sides (celebration effect)
   */
  const fireSideCannons = useCallback((options: ConfettiOptions = {}) => {
    const opts = { ...defaultOptions, ...options }
    const end = Date.now() + opts.duration!

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.6 },
        colors: opts.colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.6 },
        colors: opts.colors,
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [])

  /**
   * Fire realistic confetti shower
   */
  const fireRealisticShower = useCallback((options: ConfettiOptions = {}) => {
    const opts = { ...defaultOptions, ...options }
    const duration = opts.duration!
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: opts.colors,
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: opts.colors,
      })
    }, 250)
  }, [])

  /**
   * Fire purchase success celebration (combines effects)
   */
  const firePurchaseSuccess = useCallback(() => {
    // Initial burst
    fireCenterBurst({ particleCount: 150, spread: 100 })
    
    // Delayed side cannons
    setTimeout(() => {
      fireSideCannons({ duration: 2000 })
    }, 300)
  }, [fireCenterBurst, fireSideCannons])

  return {
    fireCenterBurst,
    fireSideCannons,
    fireRealisticShower,
    firePurchaseSuccess,
  }
}

export default useConfetti
