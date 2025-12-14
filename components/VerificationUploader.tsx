'use client'

import { useState, useRef } from 'react'
import DiditVerification from './DiditVerification'

interface UploadedDoc {
  path: string
  category: string
  filename: string
  preview?: string
}

interface VerificationUploaderProps {
  walletAddress?: string  // Optional - can use email instead
  email?: string          // Email as fallback identifier
  name?: string           // Full name for verification
  phone?: string          // Phone for verification
  submissionId?: string
  onUploadsChange?: (uploads: {
    selfie?: UploadedDoc
    idFront?: UploadedDoc
    idBack?: UploadedDoc
    supporting: UploadedDoc[]
  }) => void
  onVerificationStatusChange?: (status: string) => void
  onVerificationComplete?: (verified: boolean) => void   // When verification is done
}

const SUPPORTING_DOC_TYPES = [
  { value: 'dd214', label: 'DD-214 (Military Discharge)' },
  { value: 'va_card', label: 'VA ID Card' },
  { value: 'military_id', label: 'Military ID' },
  { value: 'insurance', label: 'Insurance Policy' },
  { value: 'medical', label: 'Medical Records/Bills' },
  { value: 'police_report', label: 'Police Report' },
  { value: 'court_docs', label: 'Court Documents' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other Supporting Document' },
]

export default function VerificationUploader({ 
  walletAddress, 
  email,
  name,
  phone,
  submissionId,
  onUploadsChange,
  onVerificationStatusChange,
  onVerificationComplete
}: VerificationUploaderProps) {
  // Use wallet address if available, otherwise use email as the unique identifier
  const uniqueId = walletAddress || email || ''
  
  // Verification status
  const [verificationStatus, setVerificationStatus] = useState<string>('not_started')
  
  // Supporting documents (DD-214, etc.)
  const [supporting, setSupporting] = useState<UploadedDoc[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedDocType, setSelectedDocType] = useState('dd214')
  
  const supportingRef = useRef<HTMLInputElement>(null)

  const notifyChange = (updates: Partial<{
    supporting: UploadedDoc[]
  }>) => {
    if (onUploadsChange) {
      // Didit handles ID verification now, so we only pass supporting docs
      onUploadsChange({
        selfie: undefined,
        idFront: undefined,
        idBack: undefined,
        supporting: updates.supporting !== undefined ? updates.supporting : supporting
      })
    }
  }

  const uploadFile = async (
    file: File, 
    category: 'supporting',  // Only supporting docs now, Didit handles ID
    docName?: string
  ) => {
    setError(null)
    setUploading(category)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', category)
      formData.append('unique_id', uniqueId) // wallet address or email
      if (walletAddress) formData.append('wallet_address', walletAddress)
      if (email) formData.append('email', email)
      if (submissionId) formData.append('submission_id', submissionId)
      if (docName) formData.append('doc_name', docName)

      const res = await fetch('/api/verification-upload', {
        method: 'POST',
        body: formData
      })

      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))
      
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      // Create preview for images
      let preview: string | undefined
      if (file.type.startsWith('image/')) {
        preview = URL.createObjectURL(file)
      }

      const uploaded: UploadedDoc = {
        path: data.path,
        category: data.category,
        filename: data.filename,
        preview
      }

      // Update supporting documents
      if (category === 'supporting') {
        const newSupporting = [...supporting, uploaded]
        setSupporting(newSupporting)
        notifyChange({ supporting: newSupporting })
      }

    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(null)
    }
  }

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    docName?: string
  ) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadFile(file, 'supporting', docName)
    }
    e.target.value = '' // Reset input
  }

  const removeSupporting = (index: number) => {
    const newSupporting = supporting.filter((_, i) => i !== index)
    setSupporting(newSupporting)
    notifyChange({ supporting: newSupporting })
  }

  // Handle verification status updates
  const handleVerificationStatus = (status: string) => {
    setVerificationStatus(status)
    onVerificationStatusChange?.(status)
    
    // Notify parent when verification completes
    if (status === 'completed') {
      onVerificationComplete?.(true)
    } else if (status === 'failed') {
      onVerificationComplete?.(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* STEP 1: Identity Verification (Didit KYC) */}
      <div className="rounded-xl bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm">1</div>
          <div className="flex-1">
            <h4 className="font-semibold text-white flex items-center gap-2">
              Identity Verification
              {verificationStatus === 'completed' && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✓ Complete</span>}
            </h4>
            <p className="text-sm text-white/60 mt-1">
              Quick automated ID check using your phone camera (~2 minutes)
            </p>
          </div>
        </div>
        
        <DiditVerification
          submissionId={submissionId}
          email={email}
          phone={phone}
          onStatusChange={handleVerificationStatus}
          onComplete={(status: 'completed' | 'failed' | 'cancelled') => {
            if (status === 'completed') {
              handleVerificationStatus('completed')
            }
          }}
        />
      </div>

      {/* STEP 2: Supporting Documents (Always visible) */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 font-bold text-sm">2</div>
          <div className="flex-1">
            <h4 className="font-semibold text-white flex items-center gap-2">
              Supporting Documents
              {supporting.length > 0 && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">{supporting.length} uploaded</span>}
            </h4>
            <p className="text-sm text-white/60 mt-1">
              Upload DD-214, medical records, or other documents to support your case
            </p>
          </div>
        </div>

        {/* Uploaded supporting docs */}
        {supporting.length > 0 && (
          <div className="space-y-2 mb-4">
            {supporting.map((doc, i) => (
              <div 
                key={i}
                className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 p-3"
              >
                <div className="text-2xl">📄</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{doc.filename}</div>
                  <div className="text-xs text-white/50">{doc.category}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSupporting(i)}
                  className="text-red-400 hover:text-red-300 text-sm px-2"
                >
                  ✕ Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new supporting doc */}
        <div className="flex gap-3">
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="flex-1 rounded-lg bg-white/10 border border-white/10 p-3 text-white text-sm"
          >
            {SUPPORTING_DOC_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => supportingRef.current?.click()}
            disabled={uploading === 'supporting'}
            className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-3 text-white text-sm font-medium disabled:opacity-50"
          >
            {uploading === 'supporting' ? 'Uploading...' : '+ Add Document'}
          </button>
          <input
            ref={supportingRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => {
              const label = SUPPORTING_DOC_TYPES.find(t => t.value === selectedDocType)?.label || 'Document'
              handleFileSelect(e, label)
            }}
          />
        </div>
      </div>

      {/* Privacy notice */}
      <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
        <div className="flex gap-3">
          <span className="text-xl">🔒</span>
          <div className="text-xs text-white/70">
            <strong className="text-white">Your documents are secure.</strong> Verification documents are stored 
            encrypted and only accessible by our admin team for identity verification. They will never be 
            shared publicly or used for any other purpose.
          </div>
        </div>
      </div>
    </div>
  )
}
