'use client'

/**
 * CardPaymentForm Component
 * 
 * Stripe card payment form for purchases
 * Following ISP - focused on card payment UI only
 */

import { useState } from 'react'
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { openBugReport } from '@/components/BugReportButton'
import type { CardPaymentProps, PurchaseResult } from './types'

export function CardPaymentForm({
  totalAmount,
  tokenId,
  email,
  onEmailChange,
  isMonthly,
  onMonthlyChange,
  hasNftPrice,
  quantity,
  onSuccess,
  onError
}: CardPaymentProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [cardError, setCardError] = useState('')

  const handlePayment = async () => {
    if (!stripe || !elements) return
    setSubmitting(true)
    setCardError('')
    
    try {
      const endpoint = isMonthly ? '/api/payments/stripe/subscribe' : '/api/payments/stripe/intent'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: Math.round(totalAmount * 100), 
          tokenId, 
          customerEmail: email || undefined 
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Payment failed')

      if (data.clientSecret) {
        const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
          payment_method: { card: elements.getElement(CardElement)! },
          receipt_email: email || undefined
        })
        if (error) throw error
        if (paymentIntent?.status === 'succeeded') {
          onSuccess({ success: true })
        }
      }
    } catch (e: any) {
      const errorMsg = e?.message || 'Payment failed'
      setCardError(errorMsg)
      onError(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4" data-testid="card-payment-form">
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">Email (for receipt)</label>
        <input 
          type="email" 
          data-testid="card-email-input"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/40 focus:border-blue-500" 
          placeholder="your@email.com" 
          value={email} 
          onChange={e => onEmailChange(e.target.value)} 
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">Card Details</label>
        <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3" data-testid="card-element-container">
          <CardElement 
            options={{ 
              hidePostalCode: true, 
              style: { 
                base: { 
                  fontSize: '16px', 
                  color: '#ffffff', 
                  '::placeholder': { color: 'rgba(255,255,255,0.4)' } 
                } 
              } 
            }} 
          />
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <button 
          type="button" 
          onClick={() => onMonthlyChange(!isMonthly)}
          data-testid="monthly-toggle-btn"
          aria-label={isMonthly ? 'Disable monthly donation' : 'Enable monthly donation'}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isMonthly ? 'bg-blue-600' : 'bg-white/20'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMonthly ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
        <span className="text-sm text-white/70">Make this a monthly donation</span>
      </div>
      
      {cardError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3" data-testid="card-error-message">
          <p className="text-red-400 text-sm">{cardError}</p>
          <button 
            onClick={() => openBugReport({ title: 'Card Payment Error', errorMessage: cardError, category: 'purchase' })}
            className="mt-1 text-xs text-red-300 hover:text-red-200 underline"
          >
            🐛 Report issue
          </button>
        </div>
      )}
      
      <button 
        onClick={handlePayment} 
        disabled={submitting || !stripe}
        data-testid="card-submit-btn"
        className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 px-6 py-4 font-semibold text-white shadow-lg disabled:opacity-50"
      >
        {submitting ? 'Processing...' : hasNftPrice 
          ? `Purchase ${quantity} NFT${quantity > 1 ? 's' : ''} - $${totalAmount}${isMonthly ? '/month' : ''}`
          : `Donate $${totalAmount}${isMonthly ? '/month' : ''}`}
      </button>
    </div>
  )
}
