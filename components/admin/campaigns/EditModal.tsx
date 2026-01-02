'use client'

import { useState, useEffect } from 'react'
import { getCategoryById, CATEGORIES } from '@/lib/categories'
import type { Campaign, EditFormData } from './types'

interface EditModalProps {
  campaign: Campaign | null
  isOpen: boolean
  onClose: () => void
  onSave: (data: EditFormData) => Promise<void>
  isSaving: boolean
}

/**
 * EditModal - Modal for editing campaign details
 * Allows admins to update title, story, category, goal, wallet, etc.
 */
export function EditModal({
  campaign,
  isOpen,
  onClose,
  onSave,
  isSaving
}: EditModalProps) {
  const [formData, setFormData] = useState<EditFormData>({
    title: '',
    story: '',
    category: '',
    goal: 0,
    status: '',
    creator_name: '',
    creator_email: '',
    creator_phone: '',
    creator_wallet: '',
    creator_address: {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: ''
    },
    verification_status: '',
    nft_price: 0,
    nft_editions: 0
  })

  useEffect(() => {
    if (campaign) {
      setFormData({
        title: campaign.title || '',
        story: campaign.story || '',
        category: campaign.category || '',
        goal: campaign.goal || 0,
        status: campaign.status || '',
        creator_name: campaign.creator_name || '',
        creator_email: campaign.creator_email || '',
        creator_phone: campaign.creator_phone || '',
        creator_wallet: campaign.creator_wallet || '',
        creator_address: campaign.creator_address || {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: ''
        },
        verification_status: campaign.verification_status || 'pending',
        nft_price: campaign.nft_price || 0,
        nft_editions: campaign.nft_editions || campaign.num_copies || 100
      })
    }
  }, [campaign])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(formData)
  }

  if (!isOpen || !campaign) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">✏️ Edit Campaign</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-1"
            data-testid="close-edit-modal-btn"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-white/70 mb-1">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
              data-testid="edit-title-input"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm text-white/70 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
              data-testid="edit-category-select"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-slate-800">
                  {cat.emoji} {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Goal */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Goal ($)</label>
              <input
                type="number"
                value={formData.goal}
                onChange={(e) => setFormData({ ...formData, goal: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                data-testid="edit-goal-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                data-testid="edit-status-select"
              >
                <option value="pending" className="bg-slate-800">Pending</option>
                <option value="approved" className="bg-slate-800">Approved</option>
                <option value="minted" className="bg-slate-800">Minted</option>
                <option value="pending_onchain" className="bg-slate-800">Pending On-Chain</option>
                <option value="rejected" className="bg-slate-800">Rejected</option>
              </select>
            </div>
          </div>

          {/* NFT Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">NFT Price ($)</label>
              <input
                type="number"
                step="0.01"
                value={formData.nft_price}
                onChange={(e) => setFormData({ ...formData, nft_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                data-testid="edit-nft-price-input"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Max Editions</label>
              <input
                type="number"
                value={formData.nft_editions}
                onChange={(e) => setFormData({ ...formData, nft_editions: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none"
                data-testid="edit-nft-editions-input"
              />
            </div>
          </div>

          {/* Creator Wallet */}
          <div>
            <label className="block text-sm text-white/70 mb-1">Creator Wallet</label>
            <input
              type="text"
              value={formData.creator_wallet}
              onChange={(e) => setFormData({ ...formData, creator_wallet: e.target.value })}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
              placeholder="0x..."
              data-testid="edit-wallet-input"
            />
          </div>

          {/* Story */}
          <div>
            <label className="block text-sm text-white/70 mb-1">Story</label>
            <textarea
              value={formData.story}
              onChange={(e) => setFormData({ ...formData, story: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-blue-500 focus:outline-none resize-none"
              data-testid="edit-story-textarea"
            />
          </div>

          {/* Creator Info */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-sm font-medium text-white/70 mb-3">Creator Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.creator_name}
                  onChange={(e) => setFormData({ ...formData, creator_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.creator_email}
                  onChange={(e) => setFormData({ ...formData, creator_email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              data-testid="cancel-edit-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
              data-testid="save-edit-btn"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditModal
