'use client'

import { ipfsToHttp } from '@/lib/ipfs'
import type { VerificationDocsSectionProps } from './types'

/**
 * Verification documents section
 */
export function VerificationDocsSection({
  selfie,
  idFront,
  idBack,
  documents,
}: VerificationDocsSectionProps) {
  const hasAnyDocs = selfie || idFront || idBack || (documents && documents.length > 0)

  return (
    <div className="rounded bg-white/5 border border-white/10 p-3">
      <div className="text-xs font-medium mb-2">📄 Verification Documents</div>
      {!hasAnyDocs ? (
        <div className="text-xs opacity-50">No documents uploaded</div>
      ) : (
        <div className="space-y-2">
          {selfie && (
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">Selfie:</span>
              <a href={ipfsToHttp(selfie)} target="_blank" className="text-xs text-blue-400 underline">View</a>
            </div>
          )}
          {idFront && (
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">ID Front:</span>
              <a href={ipfsToHttp(idFront)} target="_blank" className="text-xs text-blue-400 underline">View</a>
            </div>
          )}
          {idBack && (
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">ID Back:</span>
              <a href={ipfsToHttp(idBack)} target="_blank" className="text-xs text-blue-400 underline">View</a>
            </div>
          )}
          {documents && documents.length > 0 && (
            <div>
              <div className="text-xs opacity-70 mb-1">Supporting Documents ({documents.length}):</div>
              <div className="space-y-1 pl-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs opacity-50">{doc.category || 'Document'}:</span>
                    <a href={ipfsToHttp(doc.path)} target="_blank" className="text-xs text-blue-400 underline">
                      {doc.filename || `Document ${idx + 1}`}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VerificationDocsSection
