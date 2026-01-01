'use client'

import { useState, useRef } from 'react'
import type { UserProfile } from './types'

interface MentionSuggestion {
  id: string
  type: 'user' | 'campaign'
  display: string
  avatar?: string
}

interface PostComposerProps {
  content: string
  onChange: (content: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  userProfile?: UserProfile | null
  userEmail?: string
  renderContentPreview?: (content: string) => React.ReactNode
  campaigns?: { id: string; title: string; slug?: string; image_uri?: string }[]
  users?: { id: string; display_name: string; avatar_url?: string }[]
}

export function PostComposer({
  content,
  onChange,
  onSubmit,
  isSubmitting,
  userProfile,
  userEmail,
  renderContentPreview,
  campaigns = [],
  users = []
}: PostComposerProps) {
  const [selectedMedia, setSelectedMedia] = useState<string[]>([])
  const [mediaTypes, setMediaTypes] = useState<string[]>([])
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [embedInput, setEmbedInput] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionType, setMentionType] = useState<'user' | 'campaign'>('user')
  const [cursorPosition, setCursorPosition] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Get mention suggestions based on query
  const getMentionSuggestions = (): MentionSuggestion[] => {
    const query = mentionQuery.toLowerCase()
    const suggestions: MentionSuggestion[] = []

    // Add matching campaigns
    campaigns.forEach(c => {
      if (c.title.toLowerCase().includes(query) || c.slug?.toLowerCase().includes(query)) {
        suggestions.push({
          id: c.slug || c.id,
          type: 'campaign',
          display: c.title,
          avatar: c.image_uri
        })
      }
    })

    // Add matching users
    users.forEach(u => {
      if (u.display_name.toLowerCase().includes(query)) {
        suggestions.push({
          id: u.id,
          type: 'user',
          display: u.display_name,
          avatar: u.avatar_url
        })
      }
    })

    return suggestions.slice(0, 8)
  }

  // Handle text input with @ detection
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const cursor = e.target.selectionStart || 0
    setCursorPosition(cursor)
    onChange(value)

    // Check for @ mentions
    const textBeforeCursor = value.slice(0, cursor)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    
    if (atMatch) {
      setMentionQuery(atMatch[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
      setMentionQuery('')
    }
  }

  // Insert mention into content
  const insertMention = (suggestion: MentionSuggestion) => {
    const textBeforeCursor = content.slice(0, cursorPosition)
    const textAfterCursor = content.slice(cursorPosition)
    
    // Find the @ symbol position
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex === -1) return

    const prefix = suggestion.type === 'campaign' ? '@[' : '@'
    const suffix = suggestion.type === 'campaign' ? ']' : ''
    const mention = `${prefix}${suggestion.id}${suffix} `
    
    const newContent = textBeforeCursor.slice(0, atIndex) + mention + textAfterCursor
    onChange(newContent)
    setShowMentions(false)
    setMentionQuery('')
    
    // Focus back on textarea
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const addEmbed = () => {
    const url = embedInput.trim()
    if (!url) return

    let type = 'link'
    if (url.includes('youtube.com') || url.includes('youtu.be')) type = 'youtube'
    else if (url.includes('twitter.com') || url.includes('x.com')) type = 'twitter'
    else if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image'
    else if (url.match(/\.(mp4|webm|mov)$/i)) type = 'video'

    setSelectedMedia(prev => [...prev, url])
    setMediaTypes(prev => [...prev, type])
    setEmbedInput('')
    setShowEmbedModal(false)
  }

  const removeMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index))
    setMediaTypes(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = () => {
    onSubmit()
    setSelectedMedia([])
    setMediaTypes([])
  }

  const avatarLetter = userProfile?.display_name?.[0] || userEmail?.[0] || '?'

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            avatarLetter.toUpperCase()
          )}
        </div>

        <div className="flex-1">
          {/* Content Preview for mentions */}
          {content.includes('@[') && renderContentPreview && (
            <div className="mb-2 p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-white/40 mb-1">Preview:</p>
              <div className="text-white text-sm">{renderContentPreview(content)}</div>
            </div>
          )}

          {/* Text Input with Mention Autocomplete */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextChange}
              placeholder="Share an update... Type @ to mention users or campaigns"
              className="w-full bg-transparent text-white placeholder:text-white/40 resize-none focus:outline-none min-h-[80px]"
              rows={3}
              data-testid="post-content-input"
            />
            
            {/* Mention Autocomplete Dropdown */}
            {showMentions && (campaigns.length > 0 || users.length > 0) && (
              <div 
                className="absolute left-0 right-0 top-full mt-1 bg-gray-800 rounded-xl shadow-xl border border-white/10 max-h-64 overflow-y-auto z-50"
                data-testid="mention-autocomplete"
              >
                {getMentionSuggestions().length > 0 ? (
                  <>
                    {getMentionSuggestions().map((s) => (
                      <button
                        key={`${s.type}-${s.id}`}
                        onClick={() => insertMention(s)}
                        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
                        data-testid={`mention-${s.type}-${s.id}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden flex-shrink-0">
                          {s.avatar ? (
                            <img src={s.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            s.display[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{s.display}</div>
                          <div className="text-white/40 text-xs">
                            {s.type === 'campaign' ? '📢 Campaign' : '👤 User'}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="px-4 py-3 text-white/50 text-sm">
                    No matches found for "{mentionQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Media Preview */}
          {selectedMedia.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedMedia.map((url, i) => (
                <div key={i} className="relative group">
                  <div className="w-20 h-20 rounded-lg bg-white/10 overflow-hidden flex items-center justify-center">
                    {mediaTypes[i] === 'image' || mediaTypes[i] === 'gif' ? (
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    ) : mediaTypes[i] === 'youtube' ? (
                      <span className="text-2xl">▶️</span>
                    ) : (
                      <span className="text-2xl">🔗</span>
                    )}
                  </div>
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <div className="flex gap-2">
              {/* Browse Files Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center gap-1"
                title="Browse files from your computer"
                data-testid="browse-files-btn"
              >
                🖼️ <span className="text-xs hidden sm:inline">Browse</span>
              </button>
              
              {/* Add Link/Embed Button */}
              <button
                onClick={() => setShowEmbedModal(true)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors flex items-center gap-1"
                title="Add media link or embed"
                data-testid="add-link-btn"
              >
                🔗 <span className="text-xs hidden sm:inline">Link</span>
              </button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    // For now, just show a placeholder - real upload would go to storage
                    const url = URL.createObjectURL(file)
                    const type = file.type.startsWith('video') ? 'video' : 
                                 file.type === 'image/gif' ? 'gif' : 'image'
                    setSelectedMedia(prev => [...prev, url])
                    setMediaTypes(prev => [...prev, type])
                  }
                  // Reset input so same file can be selected again
                  e.target.value = ''
                }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={(!content.trim() && selectedMedia.length === 0) || isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>

      {/* Embed Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowEmbedModal(false)}>
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Add Media or Link</h3>
            <input
              type="text"
              value={embedInput}
              onChange={(e) => setEmbedInput(e.target.value)}
              placeholder="Paste URL (YouTube, Twitter, image, etc.)"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowEmbedModal(false)}
                className="px-4 py-2 text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addEmbed}
                disabled={!embedInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PostComposer
