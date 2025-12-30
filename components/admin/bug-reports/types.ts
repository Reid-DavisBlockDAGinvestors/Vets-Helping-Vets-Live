/**
 * AdminBugReports Types
 * 
 * TypeScript interfaces for bug report management
 * Following ISP - small, focused interfaces
 */

export interface BugReport {
  id: string
  created_at: string
  title: string
  description: string
  steps_to_reproduce: string | null
  expected_behavior: string | null
  screenshots: { url: string; filename: string }[]
  page_url: string | null
  user_agent: string | null
  screen_size: string | null
  user_email: string | null
  wallet_address: string | null
  category: string
  status: string
  priority: string
  resolution_notes: string | null
  tags: string[]
}

export interface BugReportStats {
  total: number
  new: number
  inProgress: number
  resolved: number
}

export interface StatusOption {
  value: string
  label: string
  color: string
}

export interface PriorityOption {
  value: string
  label: string
  color: string
}

export interface CategoryOption {
  value: string
  label: string
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'new', label: '🆕 New', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'investigating', label: '🔍 Investigating', color: 'bg-yellow-500/20 text-yellow-400' },
  { value: 'in_progress', label: '🔧 In Progress', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'resolved', label: '✅ Resolved', color: 'bg-green-500/20 text-green-400' },
  { value: 'wont_fix', label: "❌ Won't Fix", color: 'bg-gray-500/20 text-gray-400' },
  { value: 'duplicate', label: '📋 Duplicate', color: 'bg-orange-500/20 text-orange-400' },
]

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'low', label: 'Low', color: 'text-gray-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
]

export const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'general', label: '🐛 General' },
  { value: 'purchase', label: '💳 Purchase' },
  { value: 'submission', label: '📝 Submission' },
  { value: 'wallet', label: '👛 Wallet' },
  { value: 'auth', label: '🔐 Auth' },
  { value: 'display', label: '🖼️ Display' },
  { value: 'performance', label: '⚡ Performance' },
  { value: 'other', label: '❓ Other' },
]

export function getStatusBadge(status: string): StatusOption {
  return STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0]
}

export function getPriorityColor(priority: string): string {
  const opt = PRIORITY_OPTIONS.find(o => o.value === priority)
  return opt?.color || 'text-gray-400'
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
