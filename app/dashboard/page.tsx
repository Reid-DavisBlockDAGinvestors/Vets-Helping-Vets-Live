"use client"

import { useEffect, useState } from 'react'
import ContractStatus from '@/components/ContractStatus'

export default function DashboardPage() {
  const [summary, setSummary] = useState<any>(null)

  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/analytics/summary')
        if (res.ok) setSummary(await res.json())
      } catch {}
    }
    run()
  }, [])

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-semibold">Your Dashboard</h1>
      <p className="mt-2 text-white/80">Track your owned NFTs, fundraiser status, wallet balance, and updates.</p>
      <div className="mt-6 rounded border border-white/10 p-4">Placeholder: NFT holdings, fundraiser progress, edit tools.</div>
      <div className="mt-6 rounded border border-white/10 p-4">
        <h2 className="font-semibold">Platform Impact</h2>
        <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded bg-white/5 p-3">{`Funds Raised: $${summary?.fundsRaised?.toLocaleString?.() || 0}`}</div>
          <div className="rounded bg-white/5 p-3">{`Purchases: ${summary?.purchases != null ? Number(summary.purchases).toLocaleString() : 0}`}</div>
          <div className="rounded bg-white/5 p-3">{`Mints: ${summary?.mints != null ? Number(summary.mints).toLocaleString() : 0}`}</div>
          <div className="rounded bg-white/5 p-3">{`Milestones: ${summary?.milestones != null ? Number(summary.milestones).toLocaleString() : 0}`}</div>
        </div>
      </div>
      <div className="mt-6">
        <ContractStatus />
      </div>
    </div>
  )
}
