'use client'

/**
 * useRealtimeDonations Hook
 * 
 * Real-time donation feed using Supabase Realtime
 * Psychology: Live updates create urgency and social proof
 * - Seeing others donate encourages more donations
 * - Live counter creates momentum and FOMO
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export interface RealtimeDonation {
  id: string
  campaign_id: number
  amount_usd: number
  amount_bdag: number
  donor_name?: string
  created_at: string
  tx_hash?: string
}

export interface DonationStats {
  totalRaised: number
  donationCount: number
  lastDonation?: RealtimeDonation
  recentDonations: RealtimeDonation[]
}

interface UseRealtimeDonationsOptions {
  campaignId?: number
  maxRecentDonations?: number
  onNewDonation?: (donation: RealtimeDonation) => void
}

export function useRealtimeDonations({
  campaignId,
  maxRecentDonations = 10,
  onNewDonation,
}: UseRealtimeDonationsOptions = {}) {
  const [stats, setStats] = useState<DonationStats>({
    totalRaised: 0,
    donationCount: 0,
    recentDonations: [],
  })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNewDonation = useCallback((donation: RealtimeDonation) => {
    setStats(prev => ({
      totalRaised: prev.totalRaised + donation.amount_usd,
      donationCount: prev.donationCount + 1,
      lastDonation: donation,
      recentDonations: [donation, ...prev.recentDonations].slice(0, maxRecentDonations),
    }))

    // Trigger callback for confetti, sounds, etc.
    onNewDonation?.(donation)

    logger.info('[Realtime] New donation received:', donation.id)
  }, [maxRecentDonations, onNewDonation])

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    let channel: RealtimeChannel

    const setupRealtime = async () => {
      try {
        // Subscribe to purchases/events table
        const channelName = campaignId 
          ? `donations:campaign:${campaignId}` 
          : 'donations:all'

        channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'events',
              filter: campaignId ? `campaign_id=eq.${campaignId}` : undefined,
            },
            (payload) => {
              const newDonation: RealtimeDonation = {
                id: payload.new.id,
                campaign_id: payload.new.campaign_id,
                amount_usd: payload.new.amount_usd || 0,
                amount_bdag: payload.new.amount_bdag || 0,
                donor_name: payload.new.donor_name,
                created_at: payload.new.created_at,
                tx_hash: payload.new.tx_hash,
              }
              handleNewDonation(newDonation)
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setIsConnected(true)
              setError(null)
              logger.info('[Realtime] Connected to donation feed')
            } else if (status === 'CHANNEL_ERROR') {
              setError('Failed to connect to realtime feed')
              logger.error('[Realtime] Connection error')
            }
          })

      } catch (err) {
        setError('Failed to setup realtime connection')
        logger.error('[Realtime] Setup error:', err)
      }
    }

    setupRealtime()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [campaignId, handleNewDonation])

  return {
    stats,
    isConnected,
    error,
  }
}

export default useRealtimeDonations
