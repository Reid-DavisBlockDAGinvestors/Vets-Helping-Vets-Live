'use client'

import { useState, useEffect } from 'react'
import type { ApprovalModalProps, ApprovalFormData } from '../types'

/**
 * Campaign approval modal with form for NFT settings
 */
export function ApprovalModal({
  campaign,
  isOpen,
  onClose,
  onApprove,
  isApproving
}: ApprovalModalProps) {
  const [form, setForm] = useState<ApprovalFormData>({
    goal: 100,
    nft_editions: 100,
    nft_price: 1,
    creator_wallet: '',
    benchmarks: ''
  })

  // Reset form when campaign changes
  useEffect(() => {
    if (campaign) {
      setForm({
        goal: campaign.goal || 100,
        nft_editions: campaign.nft_editions || campaign.num_copies || 100,
        nft_price: campaign.nft_price || (
          campaign.goal && (campaign.nft_editions || campaign.num_copies)
            ? campaign.goal / (campaign.nft_editions || campaign.num_copies || 100)
            : 1
        ),
        creator_wallet: campaign.creator_wallet || '',
        benchmarks: ''
      })
    }
  }, [campaign])

  if (!isOpen || !campaign) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onApprove(form)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">
              ✅ Approve Campaign
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <p className="text-sm text-blue-300">
              <strong>{campaign.title}</strong>
            </p>
            <p className="text-xs text-blue-300/70 mt-1">
              This will create the campaign on the BlockDAG blockchain.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Goal (USD)</label>
              <input
                type="number"
                value={form.goal}
                onChange={(e) => setForm(f => ({ ...f, goal: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                min={1}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">NFT Editions</label>
              <input
                type="number"
                value={form.nft_editions}
                onChange={(e) => setForm(f => ({ ...f, nft_editions: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                min={1}
                required
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Price per Edition (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.nft_price}
                onChange={(e) => setForm(f => ({ ...f, nft_price: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                min={0.01}
                required
              />
              <p className="text-xs text-white/40 mt-1">
                Total potential: ${(form.nft_editions * form.nft_price).toLocaleString()}
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Creator Wallet (optional)</label>
              <input
                type="text"
                value={form.creator_wallet}
                onChange={(e) => setForm(f => ({ ...f, creator_wallet: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white font-mono text-sm"
                placeholder="0x... (leave empty to use platform wallet)"
                data-testid="creator-wallet-input"
              />
              <p className="text-xs text-white/40 mt-1">
                {form.creator_wallet 
                  ? '✓ Funds will go directly to this wallet'
                  : '💼 No wallet? Funds held on platform until creator adds one'}
              </p>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">
                Benchmarks/Milestones (one per line, optional)
              </label>
              <textarea
                value={form.benchmarks}
                onChange={(e) => setForm(f => ({ ...f, benchmarks: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
                rows={4}
                placeholder="25% - Initial equipment purchase&#10;50% - Training program begins&#10;75% - First milestone reached&#10;100% - Goal completed"
              />
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
                disabled={isApproving}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isApproving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Creating...
                  </>
                ) : (
                  <>✅ Approve & Create</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ApprovalModal
