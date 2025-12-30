'use client'

/**
 * CampaignUpdateFormV2 - Modular Campaign Update Form
 * 
 * Orchestrator component using campaign-update modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Original CampaignUpdateForm: 508 lines
 * Refactored CampaignUpdateFormV2: ~200 lines (orchestrator pattern)
 */

import { ipfsToHttp } from '@/lib/ipfs'
import { 
  useCampaignUpdateForm, 
  MediaPreview,
  type CampaignUpdateFormProps 
} from './campaign-update'

export default function CampaignUpdateFormV2({ campaign, walletAddress, onClose, onSubmitted }: CampaignUpdateFormProps) {
  const form = useCampaignUpdateForm()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" data-testid="campaign-update-modal">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gray-900 border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-white/10 p-5 flex items-start justify-between">
          <div className="flex items-center gap-4">
            {campaign.imageUri && (
              <img src={ipfsToHttp(campaign.imageUri)} alt={campaign.title} className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-white">Update Your Story</h2>
              <p className="text-sm text-white/50">{campaign.title}</p>
            </div>
          </div>
          <button onClick={onClose} data-testid="close-update-modal-btn" aria-label="Close modal"
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Success State */}
        {form.success ? (
          <div className="p-8 text-center" data-testid="success-state">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Update Submitted!</h3>
            <p className="text-white/60">Your update has been sent for review. Once approved, it will be pushed to all NFT holders.</p>
          </div>
        ) : (
          <form onSubmit={(e) => form.handleSubmit(e, campaign, walletAddress, onSubmitted)} className="p-5 space-y-5" data-testid="campaign-update-form">
            {/* Info Banner */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm">
                  <p className="text-blue-300 font-medium">Living NFT Update</p>
                  <p className="text-white/60 mt-1">Your update will be reviewed. Once approved, all NFT holders will see your updated story.</p>
                </div>
              </div>
            </div>

            {/* Update Title */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Update Title <span className="text-white/40">(optional)</span></label>
              <input type="text" value={form.formState.title} onChange={(e) => form.setTitle(e.target.value)} data-testid="update-title-input"
                placeholder="e.g., Week 2 Progress Report"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors" />
            </div>

            {/* Story Update */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Current Situation Update</label>
              <textarea value={form.formState.storyUpdate} onChange={(e) => form.setStoryUpdate(e.target.value)} data-testid="story-update-input"
                placeholder="Share your current situation, progress, or any updates..." rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none" />
            </div>

            {/* Funds Utilization */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">How Funds Have Been Used</label>
              <textarea value={form.formState.fundsUtilization} onChange={(e) => form.setFundsUtilization(e.target.value)} data-testid="funds-utilization-input"
                placeholder="Describe how the donations have been utilized..." rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none" />
            </div>

            {/* Benefits */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Benefits & Impact</label>
              <textarea value={form.formState.benefits} onChange={(e) => form.setBenefits(e.target.value)} data-testid="benefits-input"
                placeholder="Share the positive impact from the donations..." rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none" />
            </div>

            {/* Still Needed */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">What's Still Needed</label>
              <textarea value={form.formState.stillNeeded} onChange={(e) => form.setStillNeeded(e.target.value)} data-testid="still-needed-input"
                placeholder="What additional help is still needed..." rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors resize-none" />
            </div>

            {/* Media Upload */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Upload Media <span className="text-white/40">(photos, videos, audio)</span></label>
              <div className="relative">
                <input type="file" accept="image/*,video/*,audio/*,.heic,.heif" multiple onChange={form.media.handleFileChange}
                  disabled={form.media.mediaLoading || form.submitting} className="hidden" id="media-upload-v2" />
                <label htmlFor="media-upload-v2" data-testid="media-upload-label"
                  className={`flex items-center justify-center gap-3 w-full px-4 py-4 border-2 border-dashed border-white/20 rounded-xl cursor-pointer transition-colors ${
                    form.media.mediaLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500/50 hover:bg-white/5'
                  }`}>
                  {form.media.mediaLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-white/60">Processing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-white/60">Click to upload photos, videos, or audio</span>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-white/40 mt-2">Supported: JPEG, PNG, GIF, WebP, MP4, WebM, MP3, WAV. iPhone photos auto-converted.</p>

              {form.media.mediaError && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs" data-testid="media-error">
                  {form.media.mediaError}
                </div>
              )}

              <MediaPreview mediaFiles={form.media.mediaFiles} onRemove={form.media.removeMedia} />
            </div>

            {/* Error Message */}
            {form.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm" data-testid="form-error">
                {form.error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} data-testid="cancel-update-btn"
                className="flex-1 px-5 py-3 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-medium transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={form.submitting} data-testid="submit-update-btn"
                className="flex-1 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {form.submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : 'Submit Update'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
