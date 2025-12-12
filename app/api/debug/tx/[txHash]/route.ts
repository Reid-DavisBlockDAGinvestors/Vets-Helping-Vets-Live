import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ txHash: string }> }
) {
  const { txHash } = await params
  
  // Find submission by tx_hash
  const { data: subs, error } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('tx_hash', txHash)
  
  if (error) {
    return NextResponse.json({ error: 'QUERY_FAILED', details: error.message }, { status: 500 })
  }
  
  if (!subs || subs.length === 0) {
    // Try partial match
    const { data: partialMatch } = await supabaseAdmin
      .from('submissions')
      .select('id, tx_hash, campaign_id, status, visible_on_marketplace, contract_address')
      .ilike('tx_hash', `%${txHash.slice(-10)}%`)
    
    return NextResponse.json({ 
      found: false, 
      message: 'No submission found with this tx_hash',
      partialMatches: partialMatch || [],
      searchedFor: txHash
    })
  }
  
  const sub = subs[0]
  
  // Check why it might not appear in marketplace
  const issues: string[] = []
  
  if (sub.status !== 'minted') {
    issues.push(`Status is "${sub.status}", expected "minted"`)
  }
  if (sub.visible_on_marketplace !== true) {
    issues.push(`visible_on_marketplace is ${sub.visible_on_marketplace}, expected true`)
  }
  if (sub.campaign_id == null) {
    issues.push(`campaign_id is null - campaign was not created on-chain`)
  }
  if (!sub.contract_address) {
    issues.push(`contract_address is empty`)
  }
  
  // Check if contract is enabled
  const { data: enabledContracts } = await supabaseAdmin
    .from('marketplace_contracts')
    .select('contract_address, enabled')
    .eq('enabled', true)
  
  const enabledAddresses = (enabledContracts || [])
    .map((c: any) => (c.contract_address || '').toLowerCase())
  
  const fallbackAddress = (process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').toLowerCase()
  if (fallbackAddress && !enabledAddresses.includes(fallbackAddress)) {
    enabledAddresses.push(fallbackAddress)
  }
  
  const subContractLower = (sub.contract_address || '').toLowerCase()
  if (subContractLower && !enabledAddresses.includes(subContractLower)) {
    issues.push(`contract_address ${sub.contract_address} is not in enabled contracts: ${enabledAddresses.join(', ')}`)
  }
  
  return NextResponse.json({
    found: true,
    submission: {
      id: sub.id,
      status: sub.status,
      campaign_id: sub.campaign_id,
      token_id: sub.token_id,
      tx_hash: sub.tx_hash,
      contract_address: sub.contract_address,
      visible_on_marketplace: sub.visible_on_marketplace,
      title: sub.title,
      created_at: sub.created_at,
    },
    willShowInMarketplace: issues.length === 0,
    issues,
    enabledContracts: enabledAddresses,
    envContract: fallbackAddress
  })
}
