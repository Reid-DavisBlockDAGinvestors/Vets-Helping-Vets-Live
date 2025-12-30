'use client'

import { useState, useEffect } from 'react'
import { ipfsToHttp } from '@/lib/ipfs'
import { CATEGORIES, CategoryId, getCategoryById, mapLegacyCategory } from '@/lib/categories'
import VerificationUploader from './VerificationUploader'
import { supabase } from '@/lib/supabase'
import { openBugReport } from './BugReportButton'
import CaptchaWidget, { useCaptcha } from './CaptchaWidget'
import { logger } from '@/lib/logger'

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const HEIC_FORMATS = ['image/heic', 'image/heif']
const FORM_STORAGE_KEY = 'patriotpledge_submission_draft'

interface VerificationDocs {
  selfie?: { path: string; filename: string }
  idFront?: { path: string; filename: string }
  idBack?: { path: string; filename: string }
  supporting: { path: string; filename: string; category: string }[]
}

// Helper to safely access localStorage
const getStoredDraft = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(FORM_STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const saveDraft = (data: any) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const clearDraft = () => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(FORM_STORAGE_KEY)
  } catch {}
}

interface StoryFormProps {
  editSubmissionId?: string
}

export default function StoryForm({ editSubmissionId }: StoryFormProps) {
  // Form fields - now sectioned
  const [category, setCategory] = useState<CategoryId>('veteran')
  const [title, setTitle] = useState('')
  const [background, setBackground] = useState('')  // Who you are, your situation
  const [need, setNeed] = useState('')              // What you need help with
  const [fundsUsage, setFundsUsage] = useState('')  // How funds will be used
  const [goal, setGoal] = useState<number>(1000)
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [editLoadError, setEditLoadError] = useState<string | null>(null)
  
  // Contact information
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [country, setCountry] = useState('United States')
  const [wallet, setWallet] = useState('')
  const [email, setEmail] = useState('')
  
  // Verification documents
  const [verificationDocs, setVerificationDocs] = useState<VerificationDocs>({ supporting: [] })
  
  // Verification status (Didit KYC)
  const [verificationComplete, setVerificationComplete] = useState(false)
  const [diditSessionId, setDiditSessionId] = useState<string | null>(null)
  const [diditStatus, setDiditStatus] = useState<string>('not_started')
  
  // Media
  const [image, setImage] = useState<string | null>(null)
  const [mediaMime, setMediaMime] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  
  // AI & preview
  const [aiBusy, setAiBusy] = useState(false)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [previewBackend, setPreviewBackend] = useState<string | null>(null)
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const [mintMsg, setMintMsg] = useState<string>('')
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info')
  
  // Submission state
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  
  // CAPTCHA state
  const captcha = useCaptcha()
  
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  
  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setIsLoggedIn(true)
        setAuthEmail(session.user.email || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
        // Pre-fill email if not already set
        if (session.user.email && !email) {
          setEmail(session.user.email)
        }
      }
      setAuthChecked(true)
    }
    checkAuth()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setIsLoggedIn(true)
        setAuthEmail(session.user.email || null)
        setIsEmailVerified(!!session.user.email_confirmed_at)
      } else {
        setIsLoggedIn(false)
        setAuthEmail(null)
        setIsEmailVerified(false)
      }
    })
    
    return () => subscription.unsubscribe()
  }, [])

  // Load submission for editing if editSubmissionId is provided
  useEffect(() => {
    if (!editSubmissionId || editingSubmissionId === editSubmissionId) return
    
    const loadSubmission = async () => {
      setLoadingEdit(true)
      setEditLoadError(null)
      
      try {
        // Get auth token from supabase
        const { supabase } = await import('@/lib/supabase')
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        
        if (!token) {
          setEditLoadError('Please log in to edit your submission')
          setLoadingEdit(false)
          return
        }
        
        const res = await fetch(`/api/submissions/${editSubmissionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        const data = await res.json()
        
        if (!res.ok) {
          setEditLoadError(data.message || data.error || 'Failed to load submission')
          setLoadingEdit(false)
          return
        }
        
        const sub = data.submission
        logger.debug('[StoryForm] Loaded submission for editing:', sub.id)
        
        // Populate form fields from submission
        if (sub.category) setCategory(mapLegacyCategory(sub.category))
        if (sub.title) setTitle(sub.title)
        if (sub.goal) setGoal(sub.goal)
        if (sub.creator_name) {
          // Parse creator_name into first/last if possible
          const nameParts = sub.creator_name.split(' ')
          setFirstName(nameParts[0] || '')
          setLastName(nameParts.slice(1).join(' ') || '')
        }
        if (sub.company) setCompany(sub.company)
        if (sub.creator_phone) setPhone(sub.creator_phone)
        if (sub.creator_wallet) setWallet(sub.creator_wallet)
        if (sub.creator_email) setEmail(sub.creator_email)
        if (sub.image_uri) setImage(sub.image_uri)
        
        // Parse story back into sections if possible
        if (sub.story) {
          const story = sub.story as string
          // Try to extract sections from formatted story
          const aboutMatch = story.match(/About Me:\n([\s\S]*?)(?=\n\nWhat I Need:|$)/)
          const needMatch = story.match(/What I Need:\n([\s\S]*?)(?=\n\nHow Funds Will Be Used:|$)/)
          const fundsMatch = story.match(/How Funds Will Be Used:\n([\s\S]*)$/)
          
          if (aboutMatch) setBackground(aboutMatch[1].trim())
          if (needMatch) setNeed(needMatch[1].trim())
          if (fundsMatch) setFundsUsage(fundsMatch[1].trim())
          
          // If no sections found, put entire story in background
          if (!aboutMatch && !needMatch && !fundsMatch) {
            setBackground(story)
          }
        }
        
        // Parse address if available
        if (sub.creator_address) {
          const addr = sub.creator_address
          if (addr.street) setStreetAddress(addr.street)
          if (addr.city) setCity(addr.city)
          if (addr.state) setStateProvince(addr.state)
          if (addr.zip) setZipCode(addr.zip)
          if (addr.country) setCountry(addr.country)
        }
        
        // Set KYC status if available
        if (sub.didit_session_id) setDiditSessionId(sub.didit_session_id)
        if (sub.didit_status === 'Approved') {
          setDiditStatus('completed')
          setVerificationComplete(true)
        }
        
        setEditingSubmissionId(editSubmissionId)
        setDraftLoaded(true) // Mark as loaded so auto-save can begin
        
      } catch (err: any) {
        console.error('[StoryForm] Error loading submission:', err)
        setEditLoadError(err.message || 'Failed to load submission')
      } finally {
        setLoadingEdit(false)
      }
    }
    
    loadSubmission()
  }, [editSubmissionId, editingSubmissionId])

  // Load saved draft on mount (only if not editing)
  useEffect(() => {
    if (draftLoaded) return // Only run once
    if (editSubmissionId) return // Don't load draft if editing
    
    const draft = getStoredDraft()
    logger.debug('[StoryForm] Loading draft:', draft ? 'found' : 'none')
    
    if (draft) {
      if (draft.category) setCategory(mapLegacyCategory(draft.category))
      if (draft.title) setTitle(draft.title)
      if (draft.background) setBackground(draft.background)
      if (draft.need) setNeed(draft.need)
      if (draft.fundsUsage) setFundsUsage(draft.fundsUsage)
      if (draft.goal) setGoal(draft.goal)
      if (draft.firstName) setFirstName(draft.firstName)
      if (draft.lastName) setLastName(draft.lastName)
      if (draft.company) setCompany(draft.company)
      if (draft.phone) setPhone(draft.phone)
      if (draft.streetAddress) setStreetAddress(draft.streetAddress)
      if (draft.city) setCity(draft.city)
      if (draft.stateProvince) setStateProvince(draft.stateProvince)
      if (draft.zipCode) setZipCode(draft.zipCode)
      if (draft.country) setCountry(draft.country)
      if (draft.wallet) setWallet(draft.wallet)
      if (draft.email) setEmail(draft.email)
      if (draft.image) setImage(draft.image)
      if (draft.mediaMime) setMediaMime(draft.mediaMime)
      if (draft.diditSessionId) setDiditSessionId(draft.diditSessionId)
      if (draft.diditStatus) setDiditStatus(draft.diditStatus)
      if (draft.verificationComplete) setVerificationComplete(draft.verificationComplete)
    }
    // Always mark as loaded so saving can begin
    setDraftLoaded(true)
  }, [draftLoaded, editSubmissionId])

  // Auto-save draft when form fields change
  useEffect(() => {
    if (!draftLoaded) return // Don't save until we've loaded
    if (isSubmitted) return // Don't save after submission
    
    const draft = {
      category, title, background, need, fundsUsage, goal,
      firstName, lastName, company, phone, streetAddress, city, stateProvince, zipCode, country,
      wallet, email, image, mediaMime,
      diditSessionId, diditStatus, verificationComplete
    }
    saveDraft(draft)
  }, [
    category, title, background, need, fundsUsage, goal,
    firstName, lastName, company, phone, streetAddress, city, stateProvince, zipCode, country,
    wallet, email, image, mediaMime,
    diditSessionId, diditStatus, verificationComplete,
    draftLoaded, isSubmitted
  ])

  // Combine story sections into full story
  const getFullStory = () => {
    const parts = []
    if (background) parts.push(`About Me:\n${background}`)
    if (need) parts.push(`What I Need:\n${need}`)
    if (fundsUsage) parts.push(`How Funds Will Be Used:\n${fundsUsage}`)
    return parts.join('\n\n')
  }

  const showMsg = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMintMsg(msg)
    setMsgType(type)
    if (type === 'success') setTimeout(() => setMintMsg(''), 3000)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    
    const fileType = (f.type || '').toLowerCase()
    const fileName = (f.name || '').toLowerCase()
    const isHeic = HEIC_FORMATS.includes(fileType) || fileName.endsWith('.heic') || fileName.endsWith('.heif')
    
    if (isHeic) {
      setImageLoading(true)
      showMsg('Converting iPhone photo to JPEG...', 'info')
      try {
        const heic2any = (await import('heic2any')).default
        const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob
        const reader = new FileReader()
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImage(reader.result)
            setMediaMime('image/jpeg')
            showMsg('Photo converted successfully!', 'success')
          }
          setImageLoading(false)
        }
        reader.onerror = () => {
          showMsg('Failed to read converted image.', 'error')
          setImageLoading(false)
        }
        reader.readAsDataURL(blob)
      } catch (err: any) {
        showMsg('HEIC conversion failed. Please use a JPEG or PNG image.', 'error')
        setImageLoading(false)
      }
      return
    }
    
    if (!SUPPORTED_FORMATS.includes(fileType)) {
      showMsg(`Unsupported format. Please use JPEG, PNG, GIF, or WebP.`, 'error')
      return
    }
    
    setImageLoading(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setImage(reader.result)
        setMediaMime(f.type || null)
        showMsg('Image loaded!', 'success')
      }
      setImageLoading(false)
    }
    reader.onerror = () => {
      showMsg('Failed to read image file.', 'error')
      setImageLoading(false)
    }
    reader.readAsDataURL(f)
  }

  const generatePreview = async () => {
    if (!title?.trim()) return { uri: null, imageUri: null, backend: null, error: 'Title is required' }
    if (!image) return { uri: null, imageUri: null, backend: null, error: 'Please upload an image first' }
    
    try {
      const res = await fetch('/api/ipfs-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          description: getFullStory(),
          image: image,
          attributes: [{ trait_type: 'category', value: category }]
        })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || !data?.uri) {
        // Use friendly message from API if available
        const errorMsg = data?.message || data?.error || 'Preview upload failed'
        return { uri: null, imageUri: null, backend: null, error: errorMsg }
      }
      return { uri: data.uri, imageUri: data?.imageUri || null, backend: data?.backend || null }
    } catch (e:any) {
      // Network error - likely mobile connection issue
      const errorMsg = e?.message?.includes('fetch') 
        ? 'Network error. Please check your connection and try again.' 
        : (e?.message || 'Preview upload failed')
      return { uri: null, imageUri: null, backend: null, error: errorMsg }
    }
  }

  const mintPreview = async () => {
    showMsg('Generating preview...', 'info')
    const r = await generatePreview()
    if (r.uri) {
      setPreviewUri(r.uri)
      setPreviewBackend(r.backend)
      if (r.imageUri) setPreviewImageUri(r.imageUri)
      showMsg('Preview generated!', 'success')
    } else {
      showMsg(r.error || 'Preview failed', 'error')
    }
  }

  const submitForApproval = async () => {
    // Prevent re-submission
    if (isSubmitted) {
      showMsg('This campaign has already been submitted. Check your email for updates.', 'info')
      return
    }
    
    if (isSubmitting) {
      return
    }
    
    try {
      setIsSubmitting(true)
      showMsg('Submitting your campaign...', 'info')
      
      // Validation
      if (!title?.trim()) { showMsg('Please enter a title', 'error'); setIsSubmitting(false); return }
      if (!background?.trim() && !need?.trim()) { showMsg('Please describe your situation or need', 'error'); setIsSubmitting(false); return }
      if (!firstName?.trim() || !lastName?.trim()) { showMsg('First and last name are required', 'error'); setIsSubmitting(false); return }
      if (!phone?.trim()) { showMsg('Phone number is required', 'error'); setIsSubmitting(false); return }
      if (!email?.trim()) { showMsg('Email is required', 'error'); setIsSubmitting(false); return }
      // Wallet is optional - we can set it up later during the verification process
      if (!image) { showMsg('Please upload an image', 'error'); setIsSubmitting(false); return }
      
      // CAPTCHA validation (if enabled)
      if (captcha.isRequired && !captcha.isVerified) { 
        showMsg('Please complete the CAPTCHA verification', 'error'); 
        setIsSubmitting(false); 
        return 
      }
      
      // KYC is optional - they can submit without it and verify later or use manual documents
      
      let uri = previewUri
      let imgUri = previewImageUri
      if (!uri) {
        const r = await generatePreview()
        if (!r.uri) { showMsg(r.error || 'Metadata upload failed', 'error'); setIsSubmitting(false); return }
        uri = r.uri
        imgUri = r.imageUri || imgUri
        setPreviewUri(uri)
        setPreviewBackend(r.backend)
        if (r.imageUri) setPreviewImageUri(r.imageUri)
      }
      
      const payload = {
        title,
        story: getFullStory(),
        category,
        goal,
        creator_wallet: wallet,
        creator_email: email,
        creator_name: `${firstName} ${lastName}`.trim(),
        creator_first_name: firstName,
        creator_last_name: lastName,
        company: company || null,
        creator_phone: phone,
        creator_address: streetAddress ? {
          street: streetAddress,
          city,
          state: stateProvince,
          zip: zipCode,
          country
        } : null,
        image_uri: imgUri || image,
        metadata_uri: uri,
        // Verification documents
        verification_selfie: verificationDocs.selfie?.path || null,
        verification_id_front: verificationDocs.idFront?.path || null,
        verification_id_back: verificationDocs.idBack?.path || null,
        verification_documents: verificationDocs.supporting.map(d => ({
          url: d.path,
          type: d.category,
          name: d.filename
        })),
        // Didit verification
        didit_session_id: diditSessionId,
        didit_status: diditStatus === 'completed' ? 'Approved' : 'Not Started'
      }
      
      // Get auth token for authenticated submission
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        showMsg('⚠️ Account required: Please click the profile icon in the top right to log in or create an account before submitting.', 'error')
        setIsSubmitting(false)
        return
      }
      
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { 
        // Show user-friendly error messages
        const errorMsg = data?.message || data?.error || 'Submit failed'
        showMsg(errorMsg, 'error')
        setIsSubmitting(false)
        return 
      }
      
      // Mark as submitted and clear draft
      setIsSubmitted(true)
      setSubmittedId(data?.id || null)
      clearDraft() // Clear saved draft after successful submission
      showMsg('', 'success') // Clear message, we'll show a full confirmation screen
    } catch (e:any) {
      showMsg(e?.message || 'Submit failed', 'error')
      setIsSubmitting(false)
    }
  }

  const callAI = async (field: 'background' | 'need' | 'fundsUsage' | 'title', mode: 'improve' | 'expand' | 'generate' = 'improve') => {
    const fieldValue = field === 'background' ? background : field === 'need' ? need : field === 'title' ? title : fundsUsage
    
    // For generate mode, we don't need existing content
    if (mode !== 'generate' && !fieldValue?.trim()) {
      showMsg('Please write something first, then use AI to improve it', 'error')
      return
    }
    
    try {
      setAiBusy(true)
      showMsg('✨ AI is working...', 'info')
      
      const res = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode,
          field,
          content: fieldValue || '',
          context: {
            title,
            category,
            goal,
            background,
            need,
            fundsUsage
          }
        })
      })
      
      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))
      
      if (!res.ok) {
        throw new Error(data?.error || 'AI request failed')
      }
      
      if (data?.result) {
        if (field === 'background') setBackground(data.result)
        else if (field === 'need') setNeed(data.result)
        else if (field === 'title') setTitle(data.result)
        else setFundsUsage(data.result)
        showMsg(`✨ AI ${mode === 'generate' ? 'generated' : 'improved'} your ${field}!`, 'success')
      }
    } catch (err: any) {
      showMsg(err?.message || 'AI request failed', 'error')
    } finally {
      setAiBusy(false)
    }
  }

  // Show loading state when loading submission for editing
  if (loadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin h-10 w-10 border-3 border-white/30 border-t-white rounded-full mb-4" />
        <p className="text-white/70">Loading your submission...</p>
      </div>
    )
  }

  // Show error state if loading failed
  if (editLoadError) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-8 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-white mb-2">Unable to Load Submission</h3>
        <p className="text-white/70 mb-4">{editLoadError}</p>
        <a 
          href="/submit" 
          className="inline-block px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
        >
          Start a New Submission
        </a>
      </div>
    )
  }

  return (
    <form className="space-y-6 max-w-4xl">
      {/* Edit mode banner */}
      {editingSubmissionId && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <span className="text-2xl">✏️</span>
          <div>
            <h3 className="font-semibold text-amber-400">Editing Previous Submission</h3>
            <p className="text-sm text-white/70">
              Make the requested changes and resubmit. Your previous data has been loaded.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Campaign Type */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">1</div>
          <div>
            <h3 className="font-semibold text-white">Campaign Type</h3>
            <p className="text-sm text-white/50">Select the category that best describes your fundraiser</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button 
              key={cat.id}
              type="button" 
              onClick={() => setCategory(cat.id)} 
              className={`rounded-lg px-3 py-3 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                category === cat.id 
                  ? `bg-${cat.color}-500 text-white shadow-lg shadow-${cat.color}-500/25` 
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span className="text-xl">{cat.emoji}</span>
              <span className="text-xs text-center">{cat.label}</span>
            </button>
          ))}
        </div>
        {getCategoryById(category) && (
          <p className="mt-3 text-xs text-white/50">
            {getCategoryById(category)?.description}
          </p>
        )}
      </div>

      {/* Section 2: Campaign Title */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">2</div>
          <div>
            <h3 className="font-semibold text-white">Campaign Title</h3>
            <p className="text-sm text-white/50">Create a compelling title that captures attention</p>
          </div>
        </div>
        <input 
          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
          value={title} 
          onChange={e=>setTitle(e.target.value)} 
          placeholder="e.g., Help John recover from surgery and get back on his feet"
        />
      </div>

      {/* Section 3: Your Story / Background */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">3</div>
          <div>
            <h3 className="font-semibold text-white">Your Story</h3>
            <p className="text-sm text-white/50">Tell us about yourself and your situation</p>
          </div>
        </div>
        <textarea 
          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[120px]" 
          value={background} 
          onChange={e=>setBackground(e.target.value)}
          placeholder="Share your background, who you are, and what led to your current situation..."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {background?.trim() ? (
            <>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('background', 'improve')} 
                className="px-3 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                ✨ Improve
              </button>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('background', 'expand')} 
                className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                📝 Expand
              </button>
            </>
          ) : (
            <button 
              type="button" 
              disabled={aiBusy || !title?.trim()} 
              onClick={()=>callAI('background', 'generate')} 
              className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              🤖 AI Generate Draft
            </button>
          )}
          {aiBusy && <span className="text-xs text-white/50 animate-pulse">Working...</span>}
        </div>
      </div>

      {/* Section 4: What You Need */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">4</div>
          <div>
            <h3 className="font-semibold text-white">What You Need</h3>
            <p className="text-sm text-white/50">Explain specifically what you need help with</p>
          </div>
        </div>
        <textarea 
          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[100px]" 
          value={need} 
          onChange={e=>setNeed(e.target.value)}
          placeholder="What specific help do you need? Be clear about your immediate needs..."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {need?.trim() ? (
            <>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('need', 'improve')} 
                className="px-3 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                ✨ Improve
              </button>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('need', 'expand')} 
                className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                📝 Expand
              </button>
            </>
          ) : (
            <button 
              type="button" 
              disabled={aiBusy || !title?.trim()} 
              onClick={()=>callAI('need', 'generate')} 
              className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              🤖 AI Generate Draft
            </button>
          )}
        </div>
      </div>

      {/* Section 5: How Funds Will Be Used */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">5</div>
          <div>
            <h3 className="font-semibold text-white">How Funds Will Be Used</h3>
            <p className="text-sm text-white/50">Be transparent about how donations will help</p>
          </div>
        </div>
        <textarea 
          className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 min-h-[100px]" 
          value={fundsUsage} 
          onChange={e=>setFundsUsage(e.target.value)}
          placeholder="Break down how the funds will be allocated. For example: $500 for medical bills, $300 for groceries, $200 for utilities..."
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {fundsUsage?.trim() ? (
            <>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('fundsUsage', 'improve')} 
                className="px-3 py-1 text-xs rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                ✨ Improve
              </button>
              <button 
                type="button" 
                disabled={aiBusy} 
                onClick={()=>callAI('fundsUsage', 'expand')} 
                className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50 flex items-center gap-1"
              >
                📝 Expand
              </button>
            </>
          ) : (
            <button 
              type="button" 
              disabled={aiBusy} 
              onClick={()=>callAI('fundsUsage', 'generate')} 
              className="px-3 py-1 text-xs rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
            >
              🤖 AI Generate Draft
            </button>
          )}
        </div>
      </div>

      {/* Section 6: Fundraising Goal */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">6</div>
          <div>
            <h3 className="font-semibold text-white">Fundraising Goal</h3>
            <p className="text-sm text-white/50">Set a realistic goal based on your needs</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">$</span>
            <input 
              type="number" 
              className="w-full rounded-lg bg-white/10 border border-white/10 pl-8 pr-4 py-3 text-white text-xl font-semibold focus:outline-none focus:border-blue-500/50" 
              value={goal} 
              onChange={e=>setGoal(Number(e.target.value))}
              min={100}
            />
          </div>
          <span className="text-white/50">USD</span>
        </div>
      </div>

      {/* Section 7: Upload Image */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">7</div>
          <div>
            <h3 className="font-semibold text-white">Campaign Image</h3>
            <p className="text-sm text-white/50">Upload a photo that represents your campaign</p>
          </div>
        </div>
        
        {!image ? (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-blue-500/50 hover:bg-white/5 transition-all">
              <div className="text-4xl mb-3 opacity-50">📷</div>
              <p className="text-white/70 mb-2">Click to upload a photo</p>
              <p className="text-xs text-white/40">Supports JPEG, PNG, GIF, WebP, and iPhone photos (HEIC)</p>
            </div>
            <input 
              type="file" 
              accept="image/*,.heic,.heif" 
              onChange={onFile} 
              className="hidden"
              disabled={imageLoading}
            />
          </label>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black/20">
              {(mediaMime || '').startsWith('video/') ? (
                <video src={image} controls className="w-full max-h-64 object-contain" />
              ) : (
                <img src={image} alt="Preview" className="w-full max-h-64 object-contain" />
              )}
            </div>
            <button
              type="button"
              onClick={() => { setImage(null); setMediaMime(null); setPreviewUri(null); setPreviewImageUri(null); }}
              className="text-sm text-red-400 hover:text-red-300"
            >
              ✕ Remove and choose different image
            </button>
          </div>
        )}
        {imageLoading && (
          <div className="mt-3 text-yellow-400 text-sm animate-pulse">Converting image...</div>
        )}
      </div>

      {/* Section 8: Contact Info */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">8</div>
          <div>
            <h3 className="font-semibold text-white">Your Contact Information</h3>
            <p className="text-sm text-white/50">We need this to verify your identity and reach you about your campaign</p>
          </div>
        </div>
        
        {/* Personal Info */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-white/70 block mb-1">First Name <span className="text-red-400">*</span></label>
              <input 
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={firstName} 
                onChange={e=>setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 block mb-1">Last Name <span className="text-red-400">*</span></label>
              <input 
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={lastName} 
                onChange={e=>setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
            <div>
              <label className="text-sm text-white/70 block mb-1">Phone Number <span className="text-red-400">*</span></label>
              <input 
                type="tel"
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={phone} 
                onChange={e=>setPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          
          <div>
            <label className="text-sm text-white/70 block mb-1">Company / Organization <span className="text-white/40">(optional)</span></label>
            <input 
              type="text"
              className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
              value={company} 
              onChange={e=>setCompany(e.target.value)}
              placeholder="For corporate tax receipts"
            />
            <p className="text-xs text-white/40 mt-1">Include if you want the company name on tax receipts</p>
          </div>
          
          <div>
            <label className="text-sm text-white/70 block mb-1">Email Address <span className="text-red-400">*</span></label>
            <input 
              type="email"
              className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
              value={email} 
              onChange={e=>setEmail(e.target.value)}
              placeholder="your@email.com"
            />
            <p className="text-xs text-white/40 mt-1">For campaign updates and approval notifications</p>
          </div>

          {/* Address */}
          <div className="pt-4 border-t border-white/10">
            <label className="text-sm text-white/70 block mb-3">Mailing Address</label>
            <div className="space-y-3">
              <input 
                className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                value={streetAddress} 
                onChange={e=>setStreetAddress(e.target.value)}
                placeholder="Street Address"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input 
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={city} 
                  onChange={e=>setCity(e.target.value)}
                  placeholder="City"
                />
                <input 
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={stateProvince} 
                  onChange={e=>setStateProvince(e.target.value)}
                  placeholder="State"
                />
                <input 
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50" 
                  value={zipCode} 
                  onChange={e=>setZipCode(e.target.value)}
                  placeholder="ZIP Code"
                />
                <select
                  className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white focus:outline-none focus:border-blue-500/50"
                  value={country}
                  onChange={e=>setCountry(e.target.value)}
                >
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2">Used for identity verification and sending any physical materials</p>
          </div>

          {/* Wallet */}
          <div className="pt-4 border-t border-white/10">
            <label className="text-sm text-white/70 block mb-1">Wallet Address <span className="text-white/40">(optional)</span></label>
            <input 
              className="w-full rounded-lg bg-white/10 border border-white/10 p-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50 font-mono text-sm" 
              value={wallet} 
              onChange={e=>setWallet(e.target.value)}
              placeholder="0x..."
            />
            <p className="text-xs text-white/40 mt-1">Don't have a crypto wallet yet? No problem! You can add it later. We'll help you set one up during the verification process.</p>
          </div>
        </div>
      </div>

      {/* Section 9: Identity Verification */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold">9</div>
          <div>
            <h3 className="font-semibold text-white">Identity Verification</h3>
            <p className="text-sm text-white/50">Help us verify your identity and support your cause</p>
          </div>
        </div>
        
        {!email ? (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm text-yellow-300">
            ⚠️ Please enter your email address in the contact section above first. We need it to organize your verification documents.
          </div>
        ) : (
          <>
            <VerificationUploader
              walletAddress={wallet || undefined}
              email={email}
              name={`${firstName} ${lastName}`.trim()}
              phone={phone}
              submissionId={submittedId || undefined}
              onUploadsChange={(docs) => setVerificationDocs(docs as VerificationDocs)}
              onVerificationStatusChange={(status) => setDiditStatus(status)}
              onVerificationComplete={(verified) => setVerificationComplete(verified)}
            />
            
            {/* Verification Status Indicator */}
            {verificationComplete && (
              <div className="mt-4 rounded-lg bg-green-500/10 border border-green-500/20 p-4 flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <div>
                  <div className="font-medium text-green-400">Identity Verified</div>
                  <div className="text-xs text-green-400/70">You're all set to submit your campaign</div>
                </div>
              </div>
            )}
          </>
        )}
        
        {category === 'veteran' && (
          <div className="mt-4 rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
            <div className="flex gap-3">
              <span className="text-xl">🎖️</span>
              <div className="text-xs text-white/70">
                <strong className="text-white">Veterans:</strong> Please upload your DD-214 or VA ID card as a supporting 
                document. This helps us prioritize and verify veteran fundraisers.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit Section */}
      {isSubmitted ? (
        /* Success Confirmation Screen */
        <div className="rounded-xl p-8 border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-blue-500/10">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-white mb-2">Campaign Submitted Successfully!</h2>
            <p className="text-white/70 mb-6 max-w-md mx-auto">
              Your campaign "{title}" has been submitted for review. Our team will review it within 24-48 hours.
            </p>
            
            <div className="rounded-lg bg-white/5 border border-white/10 p-4 mb-6 inline-block">
              <div className="text-sm text-white/50 mb-1">Submission ID</div>
              <div className="font-mono text-white text-sm">{submittedId || 'Pending'}</div>
            </div>
            
            <div className="space-y-3 text-left max-w-md mx-auto">
              <h4 className="font-medium text-white">What happens next?</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>We'll verify your identity documents and review your story</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>You'll receive an email at <strong className="text-white">{email}</strong> with updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">✓</span>
                  <span>Once approved, your NFT fundraiser will go live on the marketplace</span>
                </li>
              </ul>
            </div>
            
            <div className="mt-6 pt-6 border-t border-white/10">
              <a 
                href="/marketplace" 
                className="inline-block rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-3 text-white font-medium transition-colors"
              >
                Browse Other Campaigns
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-xl p-6 border ${verificationComplete 
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20' 
          : 'bg-white/5 border-white/10'}`}>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Ready to Submit?</h3>
              {verificationComplete ? (
                <p className="text-sm text-white/50">✓ Identity verified! Our team will review your campaign within 24-48 hours</p>
              ) : (
                <p className="text-sm text-white/60">Identity verification is optional but speeds up approval. You can also submit documents manually.</p>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {/* CAPTCHA Widget */}
              <CaptchaWidget
                onVerify={captcha.handleVerify}
                onExpire={captcha.handleExpire}
                onError={captcha.handleError}
                theme="dark"
              />
              {captcha.error && (
                <p className="text-red-400 text-sm">CAPTCHA error: {captcha.error}</p>
              )}
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={mintPreview} 
                  disabled={isSubmitting}
                  className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 px-5 py-3 text-white transition-all disabled:opacity-50"
                >
                  Preview NFT
                </button>
                <button 
                  type="button" 
                  onClick={submitForApproval} 
                  disabled={isSubmitting || (captcha.isRequired && !captcha.isVerified)}
                  className={`rounded-lg px-6 py-3 font-medium transition-all ${!isSubmitting && (!captcha.isRequired || captcha.isVerified)
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                    : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </div>
          </div>
        
        {/* Preview */}
        {previewUri && (previewImageUri || image) && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="text-sm font-medium text-white/70 mb-3">NFT Preview</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden bg-black/30">
                <img src={ipfsToHttp((previewImageUri || image) as string)} alt="NFT Preview" className="w-full object-contain" />
              </div>
              <div className="text-sm space-y-3">
                <div>
                  <span className="text-white/50">Title:</span>
                  <p className="text-white font-medium mt-1">{title || 'Untitled'}</p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-white/50">Category:</span>
                    <p className="text-white">{category}</p>
                  </div>
                  <div>
                    <span className="text-white/50">Goal:</span>
                    <p className="text-white">${goal.toLocaleString()}</p>
                  </div>
                </div>
                {/* Story Preview */}
                <div className="border-t border-white/10 pt-3">
                  <span className="text-white/50">Story:</span>
                  <div className="mt-2 max-h-48 overflow-y-auto text-white/80 text-xs whitespace-pre-wrap bg-black/20 rounded-lg p-3">
                    {getFullStory() || 'No story provided'}
                  </div>
                </div>
                <p className="text-xs text-white/40 break-all">Metadata: {previewUri}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Message */}
        {mintMsg && (
          <div className={`mt-4 rounded-lg p-3 text-sm ${
            msgType === 'success' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
            msgType === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
            'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {mintMsg}
            {msgType === 'error' && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  logger.debug('[StoryForm] Opening bug report for error:', mintMsg)
                  openBugReport({
                    title: 'Campaign Submission Error',
                    description: `I encountered an error while trying to submit my campaign.\n\nCampaign Title: ${title || 'Not set'}\nCategory: ${category}`,
                    errorMessage: mintMsg,
                    category: 'submission'
                  })
                }}
                className="mt-2 block text-xs text-red-300 hover:text-red-200 underline"
              >
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
