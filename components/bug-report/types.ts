/**
 * BugReport Types
 * 
 * TypeScript interfaces and constants for bug reporting
 * Following ISP - small, focused interfaces
 */

export interface Screenshot {
  url: string
  filename: string
}

export interface BugReportContext {
  title?: string
  description?: string
  category?: string
  errorMessage?: string
}

export interface BugReportFormState {
  title: string
  description: string
  stepsToReproduce: string
  expectedBehavior: string
  category: string
  screenshots: Screenshot[]
}

export interface BugReportUIState {
  isOpen: boolean
  isSubmitting: boolean
  isUploading: boolean
  message: string
  messageType: 'success' | 'error'
  submitted: boolean
}

export interface AuthState {
  isLoggedIn: boolean
  userEmail: string | null
  authChecked: boolean
}

export const BUG_CATEGORIES = [
  { value: 'general', label: '🐛 General Bug' },
  { value: 'purchase', label: '💳 Purchase/Payment Issue' },
  { value: 'submission', label: '📝 Campaign Submission' },
  { value: 'wallet', label: '👛 Wallet Connection' },
  { value: 'auth', label: '🔐 Login/Account' },
  { value: 'display', label: '🖼️ Display/UI Issue' },
  { value: 'performance', label: '⚡ Performance/Speed' },
  { value: 'other', label: '❓ Other' },
] as const

// Global event emitter for triggering bug report from anywhere
class BugReportEmitter {
  private listeners: ((context: BugReportContext) => void)[] = []
  
  subscribe(listener: (context: BugReportContext) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  emit(context: BugReportContext) {
    this.listeners.forEach(l => l(context))
  }
}

export const bugReportEmitter = new BugReportEmitter()

// Helper function to open bug report from anywhere
export function openBugReport(context: BugReportContext = {}) {
  bugReportEmitter.emit(context)
}
