'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Post, Comment, CampaignPreview } from './types'

interface PostCardProps {
  post: Post
  currentUserId?: string
  isAdmin?: boolean
  comments: Comment[]
  commentsExpanded: boolean
  commentInput: string
  onToggleLike: (reactionType?: string) => void
  onToggleComments: () => void
  onCommentInputChange: (value: string) => void
  onSubmitComment: () => void
  onEditPost?: () => void
  onDeletePost?: () => void
  onEditComment?: (commentId: string) => void
  onDeleteComment?: (commentId: string) => void
  onLikeComment?: (commentId: string, reactionType?: string) => void
  renderPostContent: (content: string) => React.ReactNode
  campaignPreviews: Record<string, CampaignPreview>
  isDeleting?: boolean
  token?: string | null
}

const REACTION_EMOJIS: Record<string, string> = {
  love: '❤️',
  pray: '🙏',
  encourage: '💪',
  celebrate: '🎉',
  care: '😢'
}

export function PostCard({
  post,
  currentUserId,
  isAdmin,
  comments,
  commentsExpanded,
  commentInput,
  onToggleLike,
  onToggleComments,
  onCommentInputChange,
  onSubmitComment,
  onEditPost,
  onDeletePost,
  onEditComment,
  onDeleteComment,
  onLikeComment,
  renderPostContent,
  isDeleting,
  token
}: PostCardProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [showPostMenu, setShowPostMenu] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [showCommentReactionPicker, setShowCommentReactionPicker] = useState<string | null>(null)
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; count: number }>>({})

  // Handle comment like
  const handleCommentLike = async (commentId: string, reactionType: string = 'love') => {
    if (!token) return
    
    try {
      const res = await fetch('/api/community/like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ comment_id: commentId, reaction_type: reactionType })
      })
      
      if (res.ok) {
        const data = await res.json()
        // Update local state for immediate feedback
        setCommentLikes(prev => ({
          ...prev,
          [commentId]: {
            liked: data.liked,
            count: prev[commentId]?.count !== undefined 
              ? prev[commentId].count + (data.liked ? 1 : -1)
              : (data.liked ? 1 : 0)
          }
        }))
        // Also call parent handler if provided
        onLikeComment?.(commentId, reactionType)
      }
    } catch (e) {
      console.error('Failed to like comment:', e)
    }
    setShowCommentReactionPicker(null)
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString()
  }

  const canEdit = currentUserId === post.user_id || isAdmin
  
  const shareToSocial = (platform: string) => {
    const text = encodeURIComponent(post.content.slice(0, 280))
    const url = encodeURIComponent(`${window.location.origin}/community?post=${post.id}`)
    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      reddit: `https://reddit.com/submit?url=${url}&title=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
    }
    window.open(shareUrls[platform], '_blank', 'width=600,height=400')
    setShowShareMenu(false)
  }

  const renderMedia = (urls: string[], types: string[]) => {
    if (!urls.length) return null
    return (
      <div className={`mt-3 grid gap-2 ${urls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {urls.map((url, i) => {
          const type = types[i] || 'image'
          if (type === 'youtube') {
            const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/)?.[1]
            return (
              <div key={i} className="rounded-xl overflow-hidden aspect-video bg-black">
                <iframe src={`https://www.youtube.com/embed/${videoId}`} className="w-full h-full" allowFullScreen />
              </div>
            )
          }
          if (type === 'video') {
            return <video key={i} src={url} controls className="w-full rounded-xl max-h-96" />
          }
          if (type === 'gif' || type === 'image') {
            return <img key={i} src={url} alt="" className="w-full rounded-xl object-cover max-h-96" />
          }
          return (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              className="block p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-blue-400 text-sm truncate">
              🔗 {url}
            </a>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Post Header */}
      <div className="p-4 pb-0">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold overflow-hidden flex-shrink-0">
            {post.user.avatar_url ? (
              <img src={post.user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              post.user.display_name?.[0]?.toUpperCase() || '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">{post.user.display_name}</span>
              {post.user.is_verified && <span className="text-blue-400" title="Verified">✓</span>}
              {post.user.is_creator && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs">Creator</span>
              )}
              {post.user.is_donor && (
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs">Donor</span>
              )}
            </div>
            <span className="text-sm text-white/50">{formatDate(post.created_at)}</span>
          </div>
          
          {/* Post Actions Menu */}
          {canEdit && (
            <div className="relative">
              <button 
                onClick={() => setShowPostMenu(!showPostMenu)}
                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
              >
                ⋮
              </button>
              {showPostMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-lg shadow-xl border border-white/10 py-1 min-w-[120px] z-10">
                  {onEditPost && (
                    <button 
                      onClick={() => { onEditPost(); setShowPostMenu(false); }} 
                      className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10"
                    >
                      ✏️ Edit
                    </button>
                  )}
                  {onDeletePost && (
                    <button 
                      onClick={() => { onDeletePost(); setShowPostMenu(false); }} 
                      disabled={isDeleting}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/10"
                    >
                      {isDeleting ? '...' : '🗑️ Delete'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="p-4">
        <div className="text-white whitespace-pre-wrap">{renderPostContent(post.content)}</div>
        {renderMedia(post.media_urls, post.media_types)}
      </div>

      {/* Post Actions */}
      <div className="px-4 pb-4 flex items-center gap-4 border-t border-white/10 pt-3">
        {/* Like Button with Reaction Picker */}
        <div 
          className="relative"
          onMouseEnter={() => setShowReactionPicker(true)}
          onMouseLeave={() => setShowReactionPicker(false)}
        >
          <button
            onClick={() => onToggleLike('love')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              post.isLiked ? 'bg-red-500/20 text-red-400' : 'hover:bg-white/10 text-white/60'
            }`}
            data-testid="like-btn"
          >
            <span>{post.isLiked ? '❤️' : '🤍'}</span>
            <span className="text-sm">{post.likes_count}</span>
          </button>
          
          {showReactionPicker && (
            <div 
              className="absolute bottom-full left-0 mb-2 flex gap-1 p-2 bg-gray-800 rounded-xl shadow-xl border border-white/10 z-50"
              data-testid="reaction-picker"
            >
              {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                <button
                  key={type}
                  onClick={() => { onToggleLike(type); setShowReactionPicker(false) }}
                  className="p-2 hover:bg-white/10 rounded-lg text-xl transition-transform hover:scale-125"
                  title={type}
                  data-testid={`reaction-${type}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comment Button */}
        <button
          onClick={onToggleComments}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors"
        >
          <span>💬</span>
          <span className="text-sm">{post.comments_count}</span>
        </button>

        {/* Share Button */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-white/60 transition-colors"
          >
            <span>↗️</span>
            <span className="text-sm">Share</span>
          </button>
          
          {showShareMenu && (
            <div className="absolute right-0 bottom-full mb-2 bg-gray-800 rounded-xl shadow-xl border border-white/10 py-2 min-w-[140px]">
              <button onClick={() => shareToSocial('twitter')} className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10 flex items-center gap-2">
                <span>𝕏</span> Twitter/X
              </button>
              <button onClick={() => shareToSocial('facebook')} className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10 flex items-center gap-2">
                <span>📘</span> Facebook
              </button>
              <button onClick={() => shareToSocial('reddit')} className="w-full px-4 py-2 text-left text-sm text-white/70 hover:bg-white/10 flex items-center gap-2">
                <span>🔴</span> Reddit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {commentsExpanded && (
        <div className="border-t border-white/10 p-4 space-y-4 bg-white/[0.02]">
          {/* Comment Input */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              ?
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSubmitComment()}
                placeholder="Write a comment..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={onSubmitComment}
                disabled={!commentInput.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                Post
              </button>
            </div>
          </div>

          {/* Comments List */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => {
                const canEditComment = currentUserId === comment.user_id || isAdmin
                return (
                  <div key={comment.id} className="space-y-2">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
                        {comment.user.avatar_url ? (
                          <img src={comment.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          comment.user.display_name?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="bg-white/5 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white text-sm">{comment.user.display_name}</span>
                            {comment.user.is_verified && <span className="text-blue-400 text-xs">✓</span>}
                            <span className="text-xs text-white/40">{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="text-white/80 text-sm mt-1">{comment.content}</p>
                        </div>
                        {/* Comment Actions */}
                        <div className="flex items-center gap-3 mt-1 ml-2">
                          {/* Comment Reaction Button */}
                          <div 
                            className="relative"
                            onMouseEnter={() => setShowCommentReactionPicker(comment.id)}
                            onMouseLeave={() => setShowCommentReactionPicker(null)}
                          >
                            <button
                              onClick={() => handleCommentLike(comment.id, 'love')}
                              className={`text-xs transition-colors flex items-center gap-1 ${
                                commentLikes[comment.id]?.liked ? 'text-red-400' : 'text-white/50 hover:text-white'
                              }`}
                              data-testid={`comment-like-btn-${comment.id}`}
                            >
                              <span>{commentLikes[comment.id]?.liked ? '❤️' : '🤍'}</span>
                              <span>{commentLikes[comment.id]?.count ?? comment.likes_count ?? 0}</span>
                            </button>
                            
                            {showCommentReactionPicker === comment.id && (
                              <div 
                                className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 bg-gray-800 rounded-lg shadow-xl border border-white/10 z-50"
                                data-testid={`comment-reaction-picker-${comment.id}`}
                              >
                                {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                                  <button
                                    key={type}
                                    onClick={() => handleCommentLike(comment.id, type)}
                                    className="p-1 hover:bg-white/10 rounded text-sm transition-transform hover:scale-125"
                                    title={type}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                            className="text-xs text-white/50 hover:text-white transition-colors"
                            data-testid={`comment-reply-btn-${comment.id}`}
                          >
                            ↩️ Reply
                          </button>
                          {canEditComment && onEditComment && (
                            <button
                              onClick={() => onEditComment(comment.id)}
                              className="text-xs text-white/50 hover:text-white transition-colors"
                            >
                              ✏️ Edit
                            </button>
                          )}
                          {canEditComment && onDeleteComment && (
                            <button
                              onClick={() => onDeleteComment(comment.id)}
                              className="text-xs text-red-400/70 hover:text-red-400 transition-colors"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                        {/* Reply Input */}
                        {replyingTo === comment.id && (
                          <div className="flex gap-2 mt-2 ml-2">
                            <input
                              type="text"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && replyContent.trim()) {
                                  onCommentInputChange(`@${comment.user.display_name} ${replyContent}`)
                                  onSubmitComment()
                                  setReplyContent('')
                                  setReplyingTo(null)
                                }
                              }}
                              placeholder={`Reply to ${comment.user.display_name}...`}
                              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-blue-500/50"
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                if (replyContent.trim()) {
                                  onCommentInputChange(`@${comment.user.display_name} ${replyContent}`)
                                  onSubmitComment()
                                  setReplyContent('')
                                  setReplyingTo(null)
                                }
                              }}
                              disabled={!replyContent.trim()}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                              Reply
                            </button>
                            <button
                              onClick={() => { setReplyingTo(null); setReplyContent(''); }}
                              className="px-2 py-1.5 text-white/50 hover:text-white text-xs transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-white/40 text-sm py-4">No comments yet. Be the first!</p>
          )}
        </div>
      )}
    </div>
  )
}

export default PostCard
