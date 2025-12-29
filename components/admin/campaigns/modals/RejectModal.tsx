'use client'

import { useState, useEffect } from 'react'
import type { RejectModalProps } from '../types'

/**
 * Campaign rejection modal with reason input
 */
export function RejectModal({
  campaign,
  isOpen,
  onClose,
  onReject,
  isRejecting
}: RejectModalProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (isOpen) setReason('')
  }, [isOpen])

  if (!isOpen || !campaign) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    await onReject(reason)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-lg w-full border border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              ❌ Reject Campaign
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-300">
              <strong>{campaign.title}</strong>
            </p>
            <p className="text-xs text-red-300/70 mt-1">
              An email will be sent to the creator explaining the rejection.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                Rejection Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                rows={4}
                placeholder="Please explain why this campaign is being rejected..."
                required
              />
              <p className="text-xs text-white/40 mt-1">
                This will be included in the rejection email to the creator.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRejecting || !reason.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isRejecting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Rejecting...
                  </>
                ) : (
                  <>❌ Reject Campaign</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default RejectModal
