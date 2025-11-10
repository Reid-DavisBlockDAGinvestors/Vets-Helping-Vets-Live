import Stripe from 'stripe'

export function getStripe() {
  const key = process.env.STRIPE_KEY
  if (!key) throw new Error('STRIPE_KEY not set')
  return new Stripe(key, { apiVersion: '2024-06-20' as any })
}
