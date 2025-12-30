/**
 * Admin Users Module - Type Definitions
 */

export interface UserData {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
  last_sign_in_at: string | null
  wallet_address: string | null
  purchases_count: number
  nfts_owned: number
  total_spent_usd: number
  campaigns_created: number
  source?: 'profile' | 'purchase'
}

export interface Purchase {
  id: string
  campaign_id: number
  campaign_title: string
  amount_usd: number
  tip_usd: number
  quantity: number
  created_at: string
  tx_hash: string | null
  email: string | null
  token_id: number | null
  wallet_address: string | null
  payment_method: string
}

export interface Campaign {
  id: string
  campaign_id: number
  title: string
  image_uri: string | null
  status: string
  goal: number | null
  category: string
  created_at?: string
  purchase_count?: number
  total_spent?: number
}

export interface PurchaseStats {
  totalSpent: number
  totalNftSpent: number
  totalTips: number
  purchaseCount: number
}

export type SortBy = 'created_at' | 'purchases_count' | 'total_spent_usd'
export type SortOrder = 'asc' | 'desc'
export type DetailTab = 'purchased' | 'created' | 'history'
