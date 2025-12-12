'use client'

import { useState } from 'react'
import { ipfsToHttp } from '@/lib/ipfs'

// Supported image formats for NFTs
const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
const HEIC_FORMATS = ['image/heic', 'image/heif']

export default function StoryForm() {
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [category, setCategory] = useState<'veteran' | 'general'>('veteran')
  const [goal, setGoal] = useState<number>(1000)
  const [wallet, setWallet] = useState('')
  const [email, setEmail] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [mediaMime, setMediaMime] = useState<string | null>(null)
  const [snippet, setSnippet] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [previewBackend, setPreviewBackend] = useState<string | null>(null)
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const [mintMsg, setMintMsg] = useState<string>('')
  const [imageLoading, setImageLoading] = useState(false)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    
    const fileType = (f.type || '').toLowerCase()
    const fileName = (f.name || '').toLowerCase()
    
    console.log('[StoryForm] File selected:', fileName, 'type:', fileType, 'size:', f.size)
    
    // Check for HEIC/HEIF files (iPhone photos)
    const isHeic = HEIC_FORMATS.includes(fileType) || fileName.endsWith('.heic') || fileName.endsWith('.heif')
    
    if (isHeic) {
      setImageLoading(true)
      setMintMsg('Converting iPhone photo to JPEG... This may take a moment.')
      console.log('[StoryForm] HEIC detected, starting conversion...')
      try {
        // Dynamically import heic2any to avoid SSR issues
        const heic2any = (await import('heic2any')).default
        console.log('[StoryForm] heic2any loaded, converting...')
        const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.85 }) as Blob
        console.log('[StoryForm] Conversion complete, blob size:', blob.size)
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result
          if (typeof result === 'string') {
            console.log('[StoryForm] Image set as base64, length:', result.length)
            setImage(result)
            setMediaMime('image/jpeg')
            setMintMsg('Photo converted successfully!')
            setTimeout(() => setMintMsg(''), 2000)
          }
          setImageLoading(false)
        }
        reader.onerror = () => {
          console.error('[StoryForm] FileReader error')
          setMintMsg('Failed to read converted image.')
          setImageLoading(false)
        }
        reader.readAsDataURL(blob)
      } catch (err: any) {
        console.error('[StoryForm] HEIC conversion failed:', err?.message || err)
        // Provide clear instructions for the user
        const errorMsg = err?.message || String(err) || 'Unknown error'
        if (errorMsg.includes('ERR_LIBHEIF') || errorMsg.includes('format not supported')) {
          setMintMsg('This iPhone photo format is not supported by browser conversion. Please:\n1. Open the photo on your iPhone\n2. Tap Share → Save to Files → Options → Select "Most Compatible"\n3. Or screenshot the photo and upload the screenshot')
        } else {
          setMintMsg(`HEIC conversion failed: ${errorMsg}. Try using a JPEG or PNG image instead.`)
        }
        setImageLoading(false)
      }
      return
    }
    
    // Check for unsupported formats
    if (!SUPPORTED_FORMATS.includes(fileType)) {
      setMintMsg(`Unsupported format: ${fileType || 'unknown'}. Please use JPEG, PNG, GIF, or WebP.`)
      return
    }
    
    // Standard supported format
    console.log('[StoryForm] Reading standard image format...')
    setImageLoading(true)
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        console.log('[StoryForm] Standard image loaded, length:', result.length)
        setImage(result)
        setMediaMime(f.type || null)
        setMintMsg('Image loaded successfully!')
        setTimeout(() => setMintMsg(''), 2000)
      } else {
        console.error('[StoryForm] FileReader result is not a string')
        setMintMsg('Failed to read image file.')
      }
      setImageLoading(false)
    }
    reader.onerror = () => {
      console.error('[StoryForm] FileReader error reading standard image')
      setMintMsg('Failed to read image file.')
      setImageLoading(false)
    }
    reader.readAsDataURL(f)
  }

  const generatePreview = async (): Promise<{ uri: string | null; imageUri: string | null; backend: string | null; error?: string }> => {
    console.log('[StoryForm] generatePreview called, image set:', !!image, 'image length:', image?.length || 0)
    
    // Validate required fields
    if (!title?.trim()) {
      return { uri: null, imageUri: null, backend: null, error: 'Title is required' }
    }
    if (!image) {
      return { uri: null, imageUri: null, backend: null, error: 'Please select an image first' }
    }
    
    const imageToUpload = image
    console.log('[StoryForm] Using image for upload, length:', imageToUpload?.length || 0)
    
    try {
      const res = await fetch('/api/ipfs-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title || 'Untitled',
          description: story,
          image: imageToUpload,
          attributes: [
            { trait_type: 'category', value: category },
            snippet ? { trait_type: 'snippet', value: snippet } : undefined
          ].filter(Boolean)
        })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok || !data?.uri) {
        const msg = [data?.error || 'Preview upload failed', data?.code, data?.details].filter(Boolean).join(' | ')
        return { uri: null, imageUri: null, backend: null, error: msg }
      }
      return { uri: data.uri as string, imageUri: (data?.imageUri || null), backend: (data?.backend || null) }
    } catch (e:any) {
      return { uri: null, imageUri: null, backend: null, error: e?.message || 'Preview upload failed' }
    }
  }

  const mintPreview = async () => {
    setMintMsg('')
    const r = await generatePreview()
    if (r.uri) {
      setPreviewUri(r.uri)
      setPreviewBackend(r.backend)
      if (r.imageUri) setPreviewImageUri(r.imageUri)
    } else if (r.error) {
      setMintMsg(r.error)
    }
  }

  const doMint = async () => {
    // Disabled: creators submit for approval instead of direct mint
    setMintMsg('Direct mint is disabled. Please use "Submit for Approval".')
  }

  const submitForApproval = async () => {
    try {
      setMintMsg('')
      if (!wallet) { setMintMsg('Creator wallet required'); return }
      if (!email) { setMintMsg('Creator email required'); return }
      // Ensure we have a preview URI (upload metadata first), avoiding state race
      let uri = previewUri
      let imgUri = previewImageUri
      if (!uri) {
        const r = await generatePreview()
        if (!r.uri) { setMintMsg(r.error || 'Metadata upload failed'); return }
        uri = r.uri
        imgUri = r.imageUri || imgUri
        // also reflect to UI
        setPreviewUri(uri)
        setPreviewBackend(r.backend)
        if (r.imageUri) setPreviewImageUri(r.imageUri)
      }
      if (!uri) { setMintMsg('Metadata upload failed'); return }
      // Prefer the uploaded preview image URI when present (Supabase Storage URL)
      const imageUriForSubmit = imgUri || image
      const payload = {
        title,
        story,
        category,
        goal,
        creator_wallet: wallet,
        creator_email: email,
        image_uri: imageUriForSubmit,
        metadata_uri: uri
      }
      const res = await fetch('/api/submissions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) { 
        const msg = [data?.error || 'Submit failed', data?.code, data?.details].filter(Boolean).join(' | ')
        setMintMsg(msg)
        return 
      }
      setMintMsg('Submitted for approval. Submission ID: ' + (data?.id || ''))
    } catch (e:any) {
      setMintMsg(e?.message || 'Submit failed')
    }
  }

  const callAI = async (mode: 'summarize' | 'improve') => {
    try {
      setAiBusy(true)
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, story, mode })
      })
      const data = await res.json()
      if (data?.text) {
        if (mode === 'summarize') setSnippet(data.text)
        else setStory(data.text)
      } else {
        alert('AI did not return content')
      }
    } catch (e) {
      console.error(e)
      alert('AI request failed')
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <form className="space-y-4">
      <div className="rounded border border-white/10 p-3">
        <div className="text-sm mb-2">Choose Fundraising Type</div>
        <div className="flex gap-2" data-testid="category-toggle">
          <button type="button" onClick={()=>setCategory('veteran')} className={`rounded px-3 py-2 text-sm ${category==='veteran' ? 'bg-patriotic-red' : 'bg-white/10'}`}>Veteran</button>
          <button type="button" onClick={()=>setCategory('general')} className={`rounded px-3 py-2 text-sm ${category==='general' ? 'bg-patriotic-red' : 'bg-white/10'}`}>General / Non‑veteran</button>
        </div>
        <div className="mt-3 text-xs opacity-80">
          You can fundraise for non‑veteran causes too. Examples:
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Disasters: emergency relief, rebuilding homes</li>
            <li>Children’s issues: education, medical support</li>
            <li>Personal fundraisers: hardship recovery, community initiatives</li>
          </ul>
        </div>
      </div>
      <div>
        <label className="text-sm">Title</label>
        <input className="w-full rounded bg-white/10 p-2" value={title} onChange={e=>setTitle(e.target.value)} data-testid="input-title" />
      </div>
      <div>
        <label className="text-sm">Story</label>
        <textarea className="w-full rounded bg-white/10 p-2 h-40" value={story} onChange={e=>setStory(e.target.value)} data-testid="input-story" />
        <div className="mt-2 flex gap-2">
          <button type="button" disabled={aiBusy} onClick={()=>callAI('summarize')} className="rounded bg-white/10 px-3 py-1 text-sm" data-testid="btn-ai-summarize">AI Summarize</button>
          <button type="button" disabled={aiBusy} onClick={()=>callAI('improve')} className="rounded bg-white/10 px-3 py-1 text-sm" data-testid="btn-ai-improve">AI Improve</button>
        </div>
      </div>
      {snippet && (
        <div>
          <label className="text-sm">AI Snippet</label>
          <textarea className="w-full rounded bg-white/10 p-2 h-24" value={snippet} onChange={e=>setSnippet(e.target.value)} data-testid="input-snippet" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="text-sm">Goal (USD)</label>
          <input type="number" className="w-full rounded bg-white/10 p-2" value={goal} onChange={e=>setGoal(Number(e.target.value))} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm">Creator Wallet</label>
            <input className="w-full rounded bg-white/10 p-2" value={wallet} onChange={e=>setWallet(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Creator Email</label>
            <input className="w-full rounded bg-white/10 p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
        </div>
      </div>
      <div>
        <label className="text-sm">Image/Video</label>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*,.heic,.heif,video/*" 
            onChange={onFile} 
            data-testid="input-media" 
            disabled={imageLoading}
          />
          {imageLoading && (
            <span className="text-yellow-400 text-sm animate-pulse">Converting...</span>
          )}
        </div>
        <p className="text-xs text-white/50 mt-1">
          Supported: JPEG, PNG, GIF, WebP. iPhone photos (HEIC) will be auto-converted.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-3">
          <button type="button" onClick={mintPreview} className="rounded bg-patriotic-red px-4 py-2" data-testid="btn-preview">Generate NFT Preview</button>
          <button type="button" onClick={submitForApproval} className="rounded bg-white/10 px-4 py-2" data-testid="btn-submit-approval">Submit for Approval</button>
        </div>
        {previewUri && (
          <div className="text-xs opacity-80 break-all">
            Preview TokenURI: {previewUri}{previewBackend ? ` (storage: ${previewBackend})` : ''}
          </div>
        )}
        {(previewImageUri || (previewUri && image)) && (
          <div className="mt-3 grid gap-4 md:grid-cols-2 items-start">
            <div className="w-full rounded overflow-hidden bg-black/20">
              {((mediaMime || '').startsWith('video/')) ? (
                <video src={ipfsToHttp((previewImageUri || image) as string)} controls className="w-full" />
              ) : (
                <img src={ipfsToHttp((previewImageUri || image) as string)} alt="NFT Preview" className="w-full object-contain" />
              )}
            </div>
            <div className="text-sm space-y-2">
              <div><span className="opacity-70">Title:</span> {title || 'Untitled'}</div>
              <div><span className="opacity-70">Category:</span> {category}</div>
              <div><span className="opacity-70">Goal (USD):</span> {goal || 0}</div>
              {snippet ? (<div><span className="opacity-70">Snippet:</span> {snippet}</div>) : null}
              {story ? (
                <div>
                  <div className="opacity-70">Description:</div>
                  <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words bg-white/5 p-2 rounded">{story}</div>
                </div>
              ) : null}
            </div>
          </div>
        )}
        {mintMsg && (
          <div className="text-xs opacity-80 break-all">{mintMsg}</div>
        )}
      </div>
    </form>
  )
}
