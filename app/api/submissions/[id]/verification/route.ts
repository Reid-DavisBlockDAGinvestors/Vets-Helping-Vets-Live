import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

/**
 * Get verification status for a submission
 * GET /api/submissions/[id]/verification
 */
export async function GET(
  req: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    const submissionId = params.id

    if (!submissionId) {
      return NextResponse.json({ error: 'Missing submission ID' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select(`
        id,
        verification_status,
        didit_session_id,
        didit_status,
        didit_verified_at,
        didit_id_verified,
        didit_liveness_passed,
        didit_face_match,
        didit_features,
        didit_extracted_data
      `)
      .eq('id', submissionId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      ...data,
    })
  } catch (error: any) {
    logger.error('[Verification Status] Error:', error)
    return NextResponse.json({ error: 'Failed to get verification status' }, { status: 500 })
  }
}
