'use client'

/**
 * PageTransition Component
 * 
 * Smooth page transitions using Framer Motion
 * Following ISP - focused on animation wrapper only
 */

import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -20,
  },
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={pageVariants}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        data-testid="page-transition-wrapper"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * FadeIn Component
 * Simple fade-in animation for elements
 */
export function FadeIn({ 
  children, 
  delay = 0,
  duration = 0.5,
  className = ''
}: { 
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerContainer Component
 * Staggers child animations
 */
export function StaggerContainer({ 
  children,
  staggerDelay = 0.1,
  className = ''
}: { 
  children: ReactNode
  staggerDelay?: number
  className?: string
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * StaggerItem Component
 * Individual item within StaggerContainer
 */
export function StaggerItem({ 
  children,
  className = ''
}: { 
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * ScaleOnHover Component
 * Adds scale effect on hover
 */
export function ScaleOnHover({ 
  children,
  scale = 1.02,
  className = ''
}: { 
  children: ReactNode
  scale?: number
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
