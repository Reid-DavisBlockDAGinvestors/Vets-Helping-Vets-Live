'use client'

/**
 * StoryFormV2 - Modular Story Submission Form
 * 
 * Orchestrator component using story-form modules
 * Following ISP - delegates to focused hooks and components
 * 
 * Reduced from 1,233 lines to ~400 lines through modularization
 */

import { useState } from 'react'
import { CATEGORIES, getCategoryById } from '@/lib/categories'
import { ipfsToHttp } from '@/lib/ipfs'
import { useCaptcha } from '@/components/CaptchaWidget'
import CaptchaWidget from '@/components/CaptchaWidget'
import VerificationUploader from '@/components/VerificationUploader'
import { openBugReport } from '@/components/BugReportButton'
import { logger } from '@/lib/logger'

import { 
  useStoryForm, 
  useSubmission,
  FormSection,
  AIButtons,
  type StoryFormProps,
  type VerificationDocs
} from './story-form'

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const HEIC_FORMATS = ['image/heic', 'image/heif']

export default function StoryFormV2({ editSubmissionId }: StoryFormProps) {
  // Use modular hooks
  const form = useStoryForm(editSubmissionId)
  const { generatePreview, submitForApproval } = useSubmission(form.showMessage)
  const captcha = useCaptcha()
  
  // AI state
  const [aiBusy, setAiBusy] = useState(false)

  // Image upload handler
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    
    const fileType = (f.type || '').toLowerCase()
    const fileName = (f.name || '').toLowerCase()
    const isHeic = HEIC_FORMATS.includes(fileType) || fileName.endsWith('.heic') || fileName.endsWith('.heif')
    
    if (isHeic) {
      form.setImageLoading(true)
      form.showMessage('Converting iPhone photo to JPEG...', 'info')
      try {
        const heic2any = (await import('heic2any')).default
        const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            form.setImage(reader.result)
            form.setMediaMime('image/jpeg')
            form.showMessage('Photo converted successfully!', 'success')
          }
          form.setImageLoading(false)
        }
        reader.onerror = () => {
          form.showMessage('Failed to read converted image.', 'error')
          form.setImageLoading(false)
        }
        reader.readAsDataURL(blob)
      } catch {
        form.showMessage('HEIC conversion failed. Please use a JPEG or PNG image.', 'error')
        form.setImageLoading(false)
      }
      return
    }
    
    if (!SUPPORTED_FORMATS.includes(fileType)) {
      form.showMessage('Unsupported format. Please use JPEG, PNG, GIF, or WebP.', 'error')
      return
    }
    
    form.setImageLoading(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        form.setImage(reader.result)
        form.setMediaMime(f.type || null)
        form.showMessage('Image loaded!', 'success')
      }
      form.setImageLoading(false)
    }
    reader.onerror = () => {
      form.showMessage('Failed to read image file.', 'error')
      form.setImageLoading(false)
    }
    reader.readAsDataURL(f)
  }

  // Preview generation
  const handlePreview = async () => {
    form.showMessage('Generating preview...', 'info')
    const result = await generatePreview(
      form.storyContent.title,
      form.getFullStory(),
      form.mediaState.image || '',
      form.storyContent.category
    )
    if (result.uri) {
      form.setPreviewUri(result.uri)
      form.setPreviewBackend(result.backend)
      if (result.imageUri) form.setPreviewImageUri(result.imageUri)
      form.showMessage('Preview generated!', 'success')
    } else {
      form.showMessage(result.error || 'Preview failed', 'error')
    }
  }

  // Form submission
  const handleSubmit = async () => {
    if (form.submissionState.isSubmitted || form.submissionState.isSubmitting) return
    
    form.setIsSubmitting(true)
    form.showMessage('Submitting your campaign...', 'info')
    
    // Generate preview if needed
    let uri = form.previewState.previewUri
    let imgUri = form.previewState.previewImageUri
    
    if (!uri) {
      const preview = await generatePreview(
        form.storyContent.title,
        form.getFullStory(),
        form.mediaState.image || '',
        form.storyContent.category
      )
      if (!preview.uri) {
        form.showMessage(preview.error || 'Metadata upload failed', 'error')
        form.setIsSubmitting(false)
        return
      }
      uri = preview.uri
      imgUri = preview.imageUri || imgUri
      form.setPreviewUri(uri)
      form.setPreviewBackend(preview.backend)
      if (preview.imageUri) form.setPreviewImageUri(preview.imageUri)
    }
    
    const result = await submitForApproval({
      title: form.storyContent.title,
      story: form.getFullStory(),
      category: form.storyContent.category,
      goal: form.storyContent.goal,
      wallet: form.contactInfo.wallet,
      email: form.contactInfo.email,
      firstName: form.contactInfo.firstName,
      lastName: form.contactInfo.lastName,
      company: form.contactInfo.company,
      phone: form.contactInfo.phone,
      address: form.addressInfo.streetAddress ? {
        street: form.addressInfo.streetAddress,
        city: form.addressInfo.city,
        state: form.addressInfo.stateProvince,
        zip: form.addressInfo.zipCode,
        country: form.addressInfo.country
      } : null,
      imageUri: imgUri || form.mediaState.image || '',
      metadataUri: uri,
      verificationDocs: form.verificationState.verificationDocs,
      diditSessionId: form.verificationState.diditSessionId,
      diditStatus: form.verificationState.diditStatus
    }, captcha.isVerified, captcha.isRequired)
    
    if (result.success) {
      form.markSubmitted(result.id || null)
      form.showMessage('', 'success')
    } else {
      form.showMessage(result.error || 'Submit failed', 'error')
      form.setIsSubmitting(false)
    }
  }

  // AI assistance
  const callAI = async (field: 'background' | 'need' | 'fundsUsage' | 'title', mode: 'improve' | 'expand' | 'generate' = 'improve') => {
    const fieldValue = field === 'background' ? form.storyContent.background 
      : field === 'need' ? form.storyContent.need 
      : field === 'title' ? form.storyContent.title 
      : form.storyContent.fundsUsage
    
    if (mode !== 'generate' && !fieldValue?.trim()) {
      form.showMessage('Please write something first, then use AI to improve it', 'error')
      return
    }
    
    try {
      setAiBusy(true)
      form.showMessage('✨ AI is working...', 'info')
      
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode, field,
          content: fieldValue || '',
          context: {
            title: form.storyContent.title,
            category: form.storyContent.category,
            goal: form.storyContent.goal,
            background: form.storyContent.background,
            need: form.storyContent.need,
            fundsUsage: form.storyContent.fundsUsage
          }
        })
      })
      
      const data = await res.json().catch(() => ({ error: 'Invalid response' }))
      if (!res.ok) throw new Error(data?.error || 'AI request failed')
      
      if (data?.result) {
        if (field === 'background') form.setBackground(data.result)
        else if (field === 'need') form.setNeed(data.result)
        else if (field === 'title') form.setTitle(data.result)
        else form.setFundsUsage(data.result)
        form.showMessage(`✨ AI ${mode === 'generate' ? 'generated' : 'improved'} your ${field}!`, 'success')
      }
    } catch (err: any) {
      form.showMessage(err?.message || 'AI request failed', 'error')
    } finally {
      setAiBusy(false)
    }
  }

  // Loading state
  if (form.editState.loadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin h-10 w-10 border-3 border-white/30 border-t-white rounded-full mb-4" />
        <p className="text-white/70">Loading your submission...</p>
      </div>
    )
  }

  // Error state
  if (form.editState.editLoadError) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Submission</h3>
        <p className="text-white/70 mb-4">{form.editState.editLoadError}</p>
        <a href="/submit" className="inline-block px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors">
          Start a New Submission
        </a>
      </div>
    )
  }

  return (
    <form data-testid="story-form" className="space-y-6 max-w-4xl">
      {/* Edit mode banner */}
      {form.editState.editingSubmissionId && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <span className="text-2xl">✏️</span>
          <div>
            <h3 className="font-semibold text-amber-400">Editing Previous Submission</h3>
            <p className="text-sm text-white/70">Make the requested changes and resubmit.</p>
          </div>
        </div>
      )}

      {/* Section 1: Campaign Type */}
      <FormSection sectionNumber={1} title="Campaign Type" subtitle="Select the category that best describes your fundraiser">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button key={cat.id} type="button" onClick={() => form.setCategory(cat.id)}
              data-testid={`category-btn-${cat.id}`}
              className={`rounded-lg px-3 py-3 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                form.storyContent.category === cat.id 
                  ? 'bg-blue-500 text-white shadow-lg' 
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}>
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-xs text-center">{cat.label}</span>
            </button>
          ))}
        </div>
        {getCategoryById(form.storyContent.category) && (
          <p className="mt-3 text-xs text-white/50">{getCategoryById(form.storyContent.category)?.description}</p>
        )}
      </FormSection>

      {/* Section 2: Campaign Title */}
      <FormSection sectionNumber={2} title="Campaign Title" subtitle="Create a compelling title that captures attention">
        <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
          data-testid="story-title-input"
          aria-label="Campaign title"
          value={form.storyContent.title} onChange={e => form.setTitle(e.target.value)} 
          placeholder="e.g., Help John recover from surgery and get back on his feet" />
      </FormSection>

      {/* Section 3: Your Story */}
      <FormSection sectionNumber={3} title="Your Story" subtitle="Tell us about yourself and your situation">
        <textarea className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[120px]" 
          data-testid="story-background-input"
          aria-label="Your story background"
          value={form.storyContent.background} onChange={e => form.setBackground(e.target.value)}
          placeholder="Share your background, who you are, and what led to your current situation..." />
        <AIButtons field="background" value={form.storyContent.background} aiBusy={aiBusy} onAIAction={callAI} hasTitle={!!form.storyContent.title?.trim()} />
      </FormSection>

      {/* Section 4: What You Need */}
      <FormSection sectionNumber={4} title="What You Need" subtitle="Explain specifically what you need help with">
        <textarea className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[100px]" 
          data-testid="story-need-input"
          aria-label="What you need"
          value={form.storyContent.need} onChange={e => form.setNeed(e.target.value)}
          placeholder="What specific help do you need? Be clear about your immediate needs..." />
        <AIButtons field="need" value={form.storyContent.need} aiBusy={aiBusy} onAIAction={callAI} hasTitle={!!form.storyContent.title?.trim()} />
      </FormSection>

      {/* Section 5: How Funds Will Be Used */}
      <FormSection sectionNumber={5} title="How Funds Will Be Used" subtitle="Be transparent about how donations will help">
        <textarea className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[100px]" 
          data-testid="story-funds-input"
          aria-label="How funds will be used"
          value={form.storyContent.fundsUsage} onChange={e => form.setFundsUsage(e.target.value)}
          placeholder="Break down how the funds will be allocated..." />
        <AIButtons field="fundsUsage" value={form.storyContent.fundsUsage} aiBusy={aiBusy} onAIAction={callAI} hasTitle={!!form.storyContent.title?.trim()} />
      </FormSection>

      {/* Section 6: Fundraising Goal */}
      <FormSection sectionNumber={6} title="Fundraising Goal" subtitle="Set a realistic goal based on your needs">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
            <input type="number" className="w-full rounded-lg bg-white/10 border border-white/10 pl-8 pr-4 py-3 text-white text-xl font-semibold focus:outline-none focus:border-blue-500/50" 
              data-testid="story-goal-input"
              aria-label="Fundraising goal in USD"
              value={form.storyContent.goal} onChange={e => form.setGoal(Number(e.target.value))} min={100} />
          </div>
          <span className="text-white/50">USD</span>
        </div>
      </FormSection>

      {/* Section 7: Campaign Image */}
      <FormSection sectionNumber={7} title="Campaign Image" subtitle="Upload a photo that represents your campaign">
        {!form.mediaState.image ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 hover:bg-white/5 transition-all">
              <div className="text-4xl mb-3 opacity-50">📷</div>
              <p className="text-white/70 mb-2">Click to upload a photo</p>
              <p className="text-xs text-white/40">Supports JPEG, PNG, GIF, WebP, and iPhone photos (HEIC)</p>
            </div>
            <input type="file" accept="image/*,.heic,.heif" onChange={onFile} className="hidden" disabled={form.mediaState.imageLoading} />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black/20">
              {(form.mediaState.mediaMime || '').startsWith('video/') ? (
                <video src={form.mediaState.image} controls className="w-full max-h-64 object-contain" />
              ) : (
                <img src={form.mediaState.image} alt="Preview" className="w-full max-h-64 object-contain" />
              )}
            </div>
            <button type="button" onClick={() => { form.setImage(null); form.setMediaMime(null); form.setPreviewUri(null); form.setPreviewImageUri(null) }}
              className="text-sm text-red-400 hover:text-red-300">
              ✕ Remove and choose different image
            </button>
          </div>
        )}
        {form.mediaState.imageLoading && <div className="mt-3 text-yellow-400 text-sm animate-pulse">Converting image...</div>}
      </FormSection>

      {/* Section 8: Contact Info */}
      <FormSection sectionNumber={8} title="Your Contact Information" subtitle="We need this to verify your identity and reach you">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/70 block mb-1">First Name <span className="text-red-400">*</span></label>
              <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={form.contactInfo.firstName} onChange={e => form.setFirstName(e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="text-sm text-white/70 block mb-1">Last Name <span className="text-red-400">*</span></label>
              <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={form.contactInfo.lastName} onChange={e => form.setLastName(e.target.value)} placeholder="Doe" />
            </div>
            <div>
              <label className="text-sm text-white/70 block mb-1">Phone Number <span className="text-red-400">*</span></label>
              <input type="tel" className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={form.contactInfo.phone} onChange={e => form.setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-white/70 block mb-1">Company / Organization <span className="text-white/40">(optional)</span></label>
            <input type="text" className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
              value={form.contactInfo.company} onChange={e => form.setCompany(e.target.value)} placeholder="For corporate tax receipts" />
          </div>
          
          <div>
            <label className="text-sm text-white/70 block mb-1">Email Address <span className="text-red-400">*</span></label>
            <input type="email" className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
              value={form.contactInfo.email} onChange={e => form.setEmail(e.target.value)} placeholder="your@email.com" />
          </div>

          {/* Address */}
          <div className="pt-4 border-t border-white/10">
            <label className="text-sm text-white/70 block mb-3">Mailing Address</label>
            <div className="space-y-3">
              <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={form.addressInfo.streetAddress} onChange={e => form.setStreetAddress(e.target.value)} placeholder="Street Address" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={form.addressInfo.city} onChange={e => form.setCity(e.target.value)} placeholder="City" />
                <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={form.addressInfo.stateProvince} onChange={e => form.setStateProvince(e.target.value)} placeholder="State" />
                <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={form.addressInfo.zipCode} onChange={e => form.setZipCode(e.target.value)} placeholder="ZIP Code" />
                <select className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white focus:outline-none focus:border-blue-500/50"
                  value={form.addressInfo.country} onChange={e => form.setCountry(e.target.value)}>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Wallet */}
          <div className="pt-4 border-t border-white/10">
            <label className="text-sm text-white/70 block mb-1">Wallet Address <span className="text-white/40">(optional)</span></label>
            <input className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 font-mono text-sm" 
              value={form.contactInfo.wallet} onChange={e => form.setWallet(e.target.value)} placeholder="0x..." />
            <p className="text-xs text-white/40 mt-1">Don't have a wallet? No problem! You can add it later.</p>
          </div>
        </div>
      </FormSection>

      {/* Section 9: Identity Verification */}
      <FormSection sectionNumber={9} title="Identity Verification" subtitle="Help us verify your identity" variant="orange">
        {!form.contactInfo.email ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm text-yellow-300">
            ⚠️ Please enter your email address above first.
          </div>
        ) : (
          <>
            <VerificationUploader
              walletAddress={form.contactInfo.wallet || undefined}
              email={form.contactInfo.email}
              name={`${form.contactInfo.firstName} ${form.contactInfo.lastName}`.trim()}
              phone={form.contactInfo.phone}
              submissionId={form.submissionState.submittedId || undefined}
              onUploadsChange={(docs) => form.setVerificationDocs(docs as VerificationDocs)}
              onVerificationStatusChange={(status) => form.setDiditStatus(status)}
              onVerificationComplete={(verified) => form.setVerificationComplete(verified)}
            />
            {form.verificationState.verificationComplete && (
              <div className="mt-4 rounded-lg bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <div className="font-medium text-green-400">Identity Verified</div>
                  <div className="text-xs text-green-400/70">You're all set to submit</div>
                </div>
              </div>
            )}
          </>
        )}
        {form.storyContent.category === 'veteran' && (
          <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <div className="flex gap-3">
              <span className="text-xl">🎖️</span>
              <div className="text-xs text-white/70">
                <strong className="text-white">Veterans:</strong> Please upload your DD-214 or VA ID card.
              </div>
            </div>
          </div>
        )}
      </FormSection>

      {/* Submit Section */}
      {form.submissionState.isSubmitted ? (
        <div className="rounded-xl p-8 border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-blue-500/10">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">Campaign Submitted Successfully!</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Your campaign "{form.storyContent.title}" has been submitted for review.
            </p>
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-6 inline-block">
              <div className="text-sm text-white/50 mb-1">Submission ID</div>
              <div className="font-mono text-white text-sm">{form.submissionState.submittedId || 'Pending'}</div>
            </div>
            <div className="mt-6 pt-6 border-t border-white/10">
              <a href="/marketplace" className="inline-block rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-3 text-white font-medium transition-colors">
                Browse Other Campaigns
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl p-6 border ${form.verificationState.verificationComplete 
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20' 
          : 'bg-white/5 border-white/10'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Ready to Submit?</h3>
              <p className="text-sm text-white/50">
                {form.verificationState.verificationComplete 
                  ? '✓ Identity verified! Our team will review within 24-48 hours'
                  : 'Identity verification is optional but speeds up approval.'}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <CaptchaWidget onVerify={captcha.handleVerify} onExpire={captcha.handleExpire} onError={captcha.handleError} theme="dark" />
              {captcha.error && <p className="text-red-400 text-sm">CAPTCHA error: {captcha.error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={handlePreview} disabled={form.submissionState.isSubmitting}
                  data-testid="story-preview-btn"
                  className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-3 text-white transition-all disabled:opacity-50">
                  Preview NFT
                </button>
                <button type="button" onClick={handleSubmit} disabled={form.submissionState.isSubmitting || (captcha.isRequired && !captcha.isVerified)}
                  data-testid="story-submit-btn"
                  className={`rounded-lg px-6 py-3 font-medium transition-all ${
                    !form.submissionState.isSubmitting && (!captcha.isRequired || captcha.isVerified)
                      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                      : 'bg-white/10 text-white/40 cursor-not-allowed'}`}>
                  {form.submissionState.isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        
          {/* Preview */}
          {form.previewState.previewUri && (form.previewState.previewImageUri || form.mediaState.image) && (
            <div className="mt-6 pt-6 border-t border-white/10">
              <h4 className="text-sm font-medium text-white/70 mb-3">NFT Preview</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden bg-black/30">
                  <img src={ipfsToHttp((form.previewState.previewImageUri || form.mediaState.image) as string)} alt="NFT Preview" className="w-full object-contain" />
                </div>
                <div className="text-sm space-y-3">
                  <div><span className="text-white/50">Title:</span><p className="text-white font-medium mt-1">{form.storyContent.title || 'Untitled'}</p></div>
                  <div className="flex gap-4">
                    <div><span className="text-white/50">Category:</span><p className="text-white">{form.storyContent.category}</p></div>
                    <div><span className="text-white/50">Goal:</span><p className="text-white">${form.storyContent.goal.toLocaleString()}</p></div>
                  </div>
                  <p className="text-xs text-white/40 break-all">Metadata: {form.previewState.previewUri}</p>
                </div>
              </div>
            </div>
          )}
        
          {/* Message */}
          {form.message && (
            <div className={`mt-4 rounded-lg p-3 text-sm ${
              form.messageType === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
              form.messageType === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
              'bg-blue-500/20 text-blue-300 border border-blue-500/30'
            }`}>
              {form.message}
              {form.messageType === 'error' && (
                <button type="button" onClick={() => {
                  logger.debug('[StoryFormV2] Opening bug report')
                  openBugReport({
                    title: 'Campaign Submission Error',
                    description: `Error: ${form.storyContent.title || 'Not set'}`,
                    errorMessage: form.message,
                    category: 'submission'
                  })
                }} className="mt-2 block text-xs text-red-300 hover:text-red-200 underline">
                  🐛 Report this issue
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </form>
  )
}
