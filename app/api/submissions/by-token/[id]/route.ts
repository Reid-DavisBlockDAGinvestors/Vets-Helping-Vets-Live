import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Check if string is a valid UUID format
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  try {
    const idParam = context.params.id
    
    // Case 1: UUID - direct lookup by submission ID (preferred, avoids cross-chain conflicts)
    if (isUUID(idParam)) {
      const { data, error } = await supabaseAdmin
        .from('submissions')
        .select('*')
        .eq('id', idParam)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        return NextResponse.json({ error: 'SUBMISSION_LOOKUP_FAILED', details: error.message }, { status: 500 })
      }
      
      if (!data) {
        return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
      }
      
      return NextResponse.json({ item: data })
    }
    
    // Case 2: Numeric ID - look up by campaign_id or token_id (legacy, may have cross-chain conflicts)
    const id = Number(idParam)
    if (!Number.isFinite(id) || id < 0) {
      return NextResponse.json({ error: 'INVALID_ID' }, { status: 400 })
    }

    const contractAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim().toLowerCase()

    // V5: Look up by campaign_id first, then fall back to token_id for legacy
    // Include 'minted' and 'approved' statuses (pending_onchain is not a valid enum value)
    const { data: rows, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .in('status', ['minted', 'approved'])
      .or(`campaign_id.eq.${id},token_id.eq.${id}`)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'SUBMISSION_LOOKUP_FAILED', details: error.message }, { status: 500 })
    }

    // Prefer submission that matches the active contract address
    let data = null
    if (rows && rows.length > 0) {
      data = rows.find((r: any) => 
        r.contract_address && r.contract_address.toLowerCase() === contractAddress
      ) || rows[0]
    }

    if (!data) {
      return NextResponse.json({ error: 'SUBMISSION_NOT_FOUND' }, { status: 404 })
    }

    return NextResponse.json({ item: data })
  } catch (e: any) {
    return NextResponse.json({ error: 'SUBMISSION_BY_TOKEN_ERROR', details: e?.message || String(e) }, { status: 500 })
  }
}
