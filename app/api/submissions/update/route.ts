import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * PATCH /api/submissions/update
 * Update campaign/submission details
 * Admin only
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check admin status - profiles uses 'role' column
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['super_admin', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Submission ID required' }, { status: 400 })
    }

    // Build update object with allowed fields only
    const allowedFields = [
      'title', 'story', 'category', 'goal', 'status',
      'creator_name', 'creator_email', 'creator_phone', 'creator_wallet',
      'creator_address', 'verification_status',
      'price_per_copy', 'num_copies',
      'chain_id', 'chain_name', 'contract_version', 'is_testnet'
    ]

    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Map frontend field names to database column names
        if (field === 'nft_price') {
          updateData.price_per_copy = updates[field]
        } else if (field === 'nft_editions') {
          updateData.num_copies = updates[field]
        } else {
          updateData[field] = updates[field]
        }
      }
    }

    // Also handle mapped fields from EditFormData
    if (updates.nft_price !== undefined) {
      updateData.price_per_copy = updates.nft_price
    }
    if (updates.nft_editions !== undefined) {
      updateData.num_copies = updates.nft_editions
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('submissions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating submission:', error)
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      submission: data,
      message: 'Submission updated successfully'
    })

  } catch (error) {
    console.error('Error in submissions/update:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
