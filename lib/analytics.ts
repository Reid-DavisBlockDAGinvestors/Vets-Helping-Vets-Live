import { supabase } from '@/lib/supabase'

export type AnalyticsEvent = {
  type: 'view' | 'purchase' | 'mint' | 'milestone' | 'donor_returned'
  amount?: number
  tokenId?: string
  user?: string
  causeType?: 'veteran' | 'general'
}

export async function trackEvent(ev: AnalyticsEvent) {
  try {
    // Requires table 'events' with columns: type, amount, token_id, user, cause_type, created_at
    const { error } = await supabase.from('events').insert({
      type: ev.type,
      amount: ev.amount || null,
      token_id: ev.tokenId || null,
      user: ev.user || null,
      cause_type: ev.causeType || null
    })
    if (error) throw error
  } catch (e) {
    console.warn('[analytics] fallback log', ev, e)
  }
}
