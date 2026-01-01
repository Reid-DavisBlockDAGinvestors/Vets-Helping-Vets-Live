'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface BountyTier {
  id: string
  name: string
  description: string
  min_reward_usd: number
  max_reward_usd: number
  min_reward_bdag: number
  max_reward_bdag: number
  color: string
  icon: string
}

interface LeaderboardEntry {
  user_id: string
  display_name: string
  avatar_url: string | null
  total_reports: number
  valid_reports: number
  total_rewards_usd: number
  total_rewards_bdag: number
  current_rank: number
  rank_title: string
}

interface UserStats {
  total_reports: number
  valid_reports: number
  total_rewards_usd: number
  total_rewards_bdag: number
  rank_title: string
  current_rank: number
}

export default function BugBountyPage() {
  const [tiers, setTiers] = useState<BountyTier[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myStats, setMyStats] = useState<UserStats | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      
      // Check auth
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)

      // Load tiers
      const tiersRes = await fetch('/api/bug-bounty?action=tiers')
      if (tiersRes.ok) {
        const data = await tiersRes.json()
        setTiers(data.tiers || [])
      }

      // Load leaderboard
      const leaderboardRes = await fetch('/api/bug-bounty?action=leaderboard')
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboard(data.leaderboard || [])
      }

      // Load my stats if logged in
      if (session?.access_token) {
        const statsRes = await fetch('/api/bug-bounty?action=my-stats', {
          headers: { authorization: `Bearer ${session.access_token}` }
        })
        if (statsRes.ok) {
          const data = await statsRes.json()
          setMyStats(data.stats)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const defaultTiers: BountyTier[] = [
    { id: 'low', name: 'Low Severity', description: 'Minor UI issues, typos, cosmetic bugs', min_reward_usd: 5, max_reward_usd: 10, min_reward_bdag: 100, max_reward_bdag: 200, color: '#22c55e', icon: '🟢' },
    { id: 'medium', name: 'Medium Severity', description: 'Functional bugs, broken features, usability issues', min_reward_usd: 10, max_reward_usd: 25, min_reward_bdag: 200, max_reward_bdag: 500, color: '#eab308', icon: '🟡' },
    { id: 'high', name: 'High Severity', description: 'Security vulnerabilities, data exposure, critical bugs', min_reward_usd: 25, max_reward_usd: 50, min_reward_bdag: 500, max_reward_bdag: 1000, color: '#f97316', icon: '🟠' },
    { id: 'critical', name: 'Critical Severity', description: 'Major security flaws, smart contract vulnerabilities', min_reward_usd: 50, max_reward_usd: 100, min_reward_bdag: 1000, max_reward_bdag: 2000, color: '#ef4444', icon: '🔴' },
  ]

  const displayTiers = tiers.length > 0 ? tiers : defaultTiers

  return (
    <div className="min-h-screen bg-gradient-to-b from-patriotic-navy to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            🐛 Bug Bounty Program
          </h1>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">
            Help us improve PatriotPledge by finding and reporting bugs. 
            Earn rewards in USD or BDAG for valid security issues and bugs.
          </p>
        </div>

        {/* My Stats (if logged in) */}
        {user && myStats && (
          <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Your Bug Hunter Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-white">{myStats.total_reports}</div>
                <div className="text-white/60 text-sm">Total Reports</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-400">{myStats.valid_reports}</div>
                <div className="text-white/60 text-sm">Valid Bugs</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">${myStats.total_rewards_usd?.toFixed(2) || '0.00'}</div>
                <div className="text-white/60 text-sm">USD Earned</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-400">{myStats.total_rewards_bdag?.toLocaleString() || '0'}</div>
                <div className="text-white/60 text-sm">BDAG Earned</div>
              </div>
            </div>
            {myStats.rank_title && (
              <div className="mt-4 text-center">
                <span className="px-4 py-2 bg-purple-500/20 rounded-full text-purple-300 font-medium">
                  🎖️ {myStats.rank_title} {myStats.current_rank ? `(#${myStats.current_rank})` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Bounty Tiers */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">💰 Reward Tiers</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayTiers.map((tier) => (
              <div 
                key={tier.id}
                className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors"
                style={{ borderLeftColor: tier.color, borderLeftWidth: 4 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{tier.icon}</span>
                  <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                </div>
                <p className="text-white/60 text-sm mb-4">{tier.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">USD</span>
                    <span className="text-green-400 font-medium">${tier.min_reward_usd} - ${tier.max_reward_usd}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">BDAG</span>
                    <span className="text-blue-400 font-medium">{tier.min_reward_bdag.toLocaleString()} - {tier.max_reward_bdag.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-12 rounded-2xl bg-white/5 border border-white/10 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">📋 How It Works</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">🔍</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">1. Find a Bug</h3>
              <p className="text-white/60 text-sm">
                Discover a bug, security issue, or vulnerability while using the platform.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">📝</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">2. Report It</h3>
              <p className="text-white/60 text-sm">
                Use our bug report form with detailed steps to reproduce the issue.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">💰</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">3. Get Rewarded</h3>
              <p className="text-white/60 text-sm">
                Once verified, receive your bounty in USD or BDAG to your wallet.
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">🏅 Bug Hunter Leaderboard</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto" />
            </div>
          ) : leaderboard.length > 0 ? (
            <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Rank</th>
                    <th className="px-4 py-3 text-left text-white/60 text-sm font-medium">Hunter</th>
                    <th className="px-4 py-3 text-center text-white/60 text-sm font-medium">Valid Bugs</th>
                    <th className="px-4 py-3 text-right text-white/60 text-sm font-medium">Total Rewards</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.user_id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className={`font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-white/60'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${entry.current_rank || i + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold overflow-hidden">
                            {entry.avatar_url ? (
                              <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              entry.display_name?.[0]?.toUpperCase() || '?'
                            )}
                          </div>
                          <div>
                            <div className="text-white font-medium">{entry.display_name}</div>
                            <div className="text-white/40 text-xs">{entry.rank_title}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-green-400 font-medium">
                        {entry.valid_reports}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-yellow-400 font-medium">${entry.total_rewards_usd?.toFixed(2) || '0.00'}</div>
                        <div className="text-blue-400 text-xs">{entry.total_rewards_bdag?.toLocaleString() || '0'} BDAG</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 rounded-2xl bg-white/5 border border-white/10">
              <div className="text-4xl mb-3">🐛</div>
              <p className="text-white/60">No bug hunters on the leaderboard yet.</p>
              <p className="text-white/40 text-sm">Be the first to report a valid bug!</p>
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg"
            data-testid="report-bug-cta"
          >
            🐛 Report a Bug Now
          </Link>
          <p className="text-white/40 text-sm mt-4">
            Click the bug icon in the bottom-right corner on any page to submit a report.
          </p>
        </div>

        {/* Rules */}
        <div className="mt-12 rounded-2xl bg-white/5 border border-white/10 p-8">
          <h2 className="text-2xl font-bold text-white mb-6">📜 Program Rules</h2>
          <ul className="space-y-3 text-white/70">
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>First reporter of a unique bug receives the bounty</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>Provide clear reproduction steps and screenshots</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-400">✓</span>
              <span>Security issues should be reported privately via bug report</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400">✗</span>
              <span>No social engineering or phishing attempts</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400">✗</span>
              <span>No denial of service attacks</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-400">✗</span>
              <span>No testing on production with real user data</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
