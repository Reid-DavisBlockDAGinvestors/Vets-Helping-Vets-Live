'use client'

/**
 * useNavbarState Hook
 * 
 * Manages navbar UI state (mobile menu, wallet dropdown, modals)
 * Following ISP - focused on UI state only
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'

export interface UseNavbarStateReturn {
  // State
  mobileMenuOpen: boolean
  walletDropdownOpen: boolean
  walletModalOpen: boolean
  mounted: boolean
  pathname: string
  
  // Refs
  walletDropdownRef: React.RefObject<HTMLDivElement | null>
  mobileMenuRef: React.RefObject<HTMLDivElement | null>
  hamburgerButtonRef: React.RefObject<HTMLButtonElement | null>
  
  // Actions
  setMobileMenuOpen: (v: boolean) => void
  setWalletDropdownOpen: (v: boolean) => void
  setWalletModalOpen: (v: boolean) => void
  toggleMobileMenu: () => void
  toggleWalletDropdown: () => void
}

export function useNavbarState(): UseNavbarStateReturn {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [walletDropdownOpen, setWalletDropdownOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()
  
  const walletDropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null)

  // Track client-side mounting for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Close wallet dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (walletDropdownRef.current && !walletDropdownRef.current.contains(target)) {
        setWalletDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  const toggleWalletDropdown = useCallback(() => {
    setWalletDropdownOpen(prev => !prev)
  }, [])

  return {
    mobileMenuOpen,
    walletDropdownOpen,
    walletModalOpen,
    mounted,
    pathname,
    walletDropdownRef,
    mobileMenuRef,
    hamburgerButtonRef,
    setMobileMenuOpen,
    setWalletDropdownOpen,
    setWalletModalOpen,
    toggleMobileMenu,
    toggleWalletDropdown
  }
}
