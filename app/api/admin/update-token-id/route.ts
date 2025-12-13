import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/update-token-id
 * Body: { submissionId: string, tokenId: number }
 * Updates a submission's token_id field
 */
export async function POST(req: NextRequest) {
  try {
    // Simple auth check - require admin header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { submissionId, tokenId } = await req.json()
    
    if (!submissionId || tokenId === undefined) {
      return NextResponse.json({ error: 'submissionId and tokenId required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    )

    const { data, error } = await supabase
      .from('submissions')
      .update({ token_id: tokenId })
      .eq('id', submissionId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      submission: {
        id: data.id,
        title: data.title,
        campaign_id: data.campaign_id,
        token_id: data.token_id
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
