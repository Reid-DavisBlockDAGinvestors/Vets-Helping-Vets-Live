'use client'

import type { KYCSectionProps } from './types'

/**
 * KYC verification status section
 */
export function KYCSection({ diditStatus, diditSessionId }: KYCSectionProps) {
  const statusColor = 
    diditStatus === 'Approved' ? 'text-green-400' :
    diditStatus === 'Declined' ? 'text-red-400' :
    'text-yellow-400'

  return (
    <div className="rounded bg-white/5 border border-white/10 p-3">
      <div className="text-xs font-medium mb-2">🔐 KYC Verification</div>
      <div className="grid md:grid-cols-2 gap-2 text-xs">
        <div>
          <span className="opacity-70">Status: </span>
          <span className={statusColor}>
            {diditStatus || 'Not Started'}
          </span>
        </div>
        {diditSessionId && (
          <div>
            <span className="opacity-70">Session: </span>
            <span className="font-mono text-[10px]">{diditSessionId.slice(0, 12)}...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default KYCSection
