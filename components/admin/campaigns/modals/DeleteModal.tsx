'use client'

import type { DeleteModalProps } from '../types'

/**
 * Campaign delete confirmation modal
 */
export function DeleteModal({
  campaign,
  isOpen,
  onClose,
  onDelete,
  isDeleting
}: DeleteModalProps) {
  if (!isOpen || !campaign) return null

  const handleDelete = async () => {
    await onDelete()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-md w-full border border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              🗑️ Delete Campaign
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-300 font-medium mb-2">
              Are you sure you want to delete this campaign?
            </p>
            <p className="text-white font-semibold">{campaign.title}</p>
            <p className="text-xs text-white/50 mt-2">
              This action cannot be undone. All associated data will be permanently removed.
            </p>
            {campaign.status === 'minted' && (
              <p className="text-xs text-orange-400 mt-2">
                ⚠️ Warning: This campaign is already minted on-chain. Deleting it will only remove it from the database.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Deleting...
                </>
              ) : (
                <>🗑️ Delete</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteModal
