/**
 * Community Module Types
 * Following ISP - focused, single-responsibility interfaces
 */

export interface PostUser {
  display_name: string
  avatar_url: string | null
  is_verified: boolean
  is_creator: boolean
  is_donor: boolean
}

export interface Post {
  id: string
  user_id: string
  campaign_id?: string
  content: string
  media_urls: string[]
  media_types: string[]
  post_type: string
  likes_count: number
  comments_count: number
  shares_count: number
  is_pinned: boolean
  is_featured: boolean
  created_at: string
  user: PostUser
  isLiked: boolean
}

export interface CommentUser {
  display_name: string
  avatar_url: string | null
  is_verified: boolean
}

export interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  likes_count: number
  user: CommentUser
}

export interface CampaignPreview {
  id: string
  title: string
  image_uri: string | null
  slug?: string
  short_code?: string
  campaign_id?: number
  category?: string
}

export interface UserProfile {
  display_name: string
  avatar_url: string | null
}

export type PostTab = 'all' | 'discussions' | 'updates' | 'media'

export interface CommunityFilters {
  activeTab: PostTab
  selectedCategory: string | null
  filterCampaign: CampaignPreview | null
}

// Props interfaces following ISP

export interface PostCardProps {
  post: Post
  currentUserId?: string
  isAdmin?: boolean
  onLike: () => void
  onComment: () => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleComments: () => void
  isExpanded: boolean
  campaignPreview?: CampaignPreview
}

export interface PostComposerProps {
  content: string
  onChange: (content: string) => void
  onSubmit: () => void
  isSubmitting: boolean
  userProfile?: UserProfile | null
  placeholder?: string
}

export interface CommentSectionProps {
  postId: string
  comments: Comment[]
  currentUserId?: string
  isAdmin?: boolean
  onAddComment: (content: string) => void
  onEditComment?: (commentId: string, content: string) => void
  onDeleteComment?: (commentId: string) => void
  isSubmitting?: boolean
}

export interface CommunitySidebarProps {
  campaigns: CampaignPreview[]
  myCampaigns: CampaignPreview[]
  selectedCampaign: CampaignPreview | null
  onSelectCampaign: (campaign: CampaignPreview | null) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}
