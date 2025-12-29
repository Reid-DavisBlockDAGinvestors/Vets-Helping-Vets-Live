'use client'

import type { PaymentTabsProps, PaymentMethod } from './types'

const TABS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'card', label: 'Card', icon: '💳' },
  { id: 'crypto', label: 'Crypto', icon: '⛓️' },
  { id: 'other', label: 'Other', icon: '📱' },
]

/**
 * Payment method tabs component
 */
export function PaymentTabs({ activeTab, onTabChange }: PaymentTabsProps) {
  return (
    <div className="flex rounded-lg bg-white/5 p-1 mb-4">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          <span className="mr-1.5">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default PaymentTabs
