import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// Admin check helper
async function isAdmin(token: string): Promise<boolean> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    { auth: { persistSession: false } }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return false
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  return profile?.role === 'admin'
}

export async function PATCH(req: NextRequest, context: { params: { id: string } }) {
  try {
    const auth = req.headers.get('authorization')
    const token = auth?.replace('Bearer ', '')
    
    if (!token || !(await isAdmin(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const updateId = context.params.id
    if (!updateId) {
      return NextResponse.json({ error: 'Update ID required' }, { status: 400 })
    }
    
    const body = await req.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )
    
    // Update the campaign update
    const { data, error } = await supabase
      .from('campaign_updates')
      .update({
        title: body.title,
        story_update: body.story_update,
        funds_utilization: body.funds_utilization,
        benefits: body.benefits,
        still_needed: body.still_needed,
        status: body.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', updateId)
      .select()
      .single()
    
    if (error) {
      logger.error('[admin/campaign-updates] Update error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, update: data })
  } catch (e: any) {
    logger.error('[admin/campaign-updates] PATCH error:', e)
    return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 })
  }
}
