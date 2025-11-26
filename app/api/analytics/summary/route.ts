import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(_req: NextRequest) {
  try {
    // Pull recent events and compute simple metrics
    const { data, error } = await supabase
      .from('events')
      .select('type, amount, token_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) throw error

    let fundsRaised = 0
    let purchases = 0
    let mints = 0
    let milestones = 0

    for (const e of data || []) {
      if (e.type === 'purchase') {
        purchases++
        fundsRaised += Number(e.amount || 0)
      }
      if (e.type === 'mint') mints++
      if (e.type === 'milestone') milestones++
    }

    const donorRetention = 0 // placeholder; compute via distinct user counts across time windows

    return NextResponse.json({ fundsRaised, purchases, mints, milestones, donorRetention })
  } catch (e) {
    // Safe fallback in dev or when Supabase is not configured
    return NextResponse.json({
      fundsRaised: 0,
      purchases: 0,
      mints: 0,
      milestones: 0,
      donorRetention: 0,
      notice: 'Analytics fallback: configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for live metrics.'
    })
  }
}
