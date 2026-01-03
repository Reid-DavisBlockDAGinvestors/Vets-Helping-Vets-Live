import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to directly query tokens table
 * GET /api/debug/tokens?chainId=11155111
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const chainId = searchParams.get('chainId')
    
    // Query 1: Count all tokens
    const { count: totalCount, error: countError } = await supabaseAdmin
      .from('tokens')
      .select('*', { count: 'exact', head: true })
    
    // Query 2: Get Sepolia tokens specifically
    const { data: sepoliaTokens, error: sepoliaError } = await supabaseAdmin
      .from('tokens')
      .select('*')
      .eq('chain_id', 11155111)
    
    // Query 3: If chainId provided, filter by it
    let filteredTokens = null
    let filteredError = null
    if (chainId) {
      const result = await supabaseAdmin
        .from('tokens')
        .select('*')
        .eq('chain_id', parseInt(chainId))
      filteredTokens = result.data
      filteredError = result.error
    }
    
    // Query 4: Get raw table info
    const { data: sampleTokens, error: sampleError } = await supabaseAdmin
      .from('tokens')
      .select('id, token_id, chain_id, contract_version')
      .order('id', { ascending: false })
      .limit(5)
    
    return NextResponse.json({
      debug: true,
      totalCount,
      countError: countError?.message || null,
      sepoliaTokensCount: sepoliaTokens?.length || 0,
      sepoliaTokens: sepoliaTokens || [],
      sepoliaError: sepoliaError?.message || null,
      filteredCount: filteredTokens?.length || 0,
      filteredError: filteredError?.message || null,
      sampleTokens: sampleTokens || [],
      sampleError: sampleError?.message || null,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...'
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
