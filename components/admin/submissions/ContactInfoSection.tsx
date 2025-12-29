'use client'

import type { ContactInfoSectionProps } from './types'

/**
 * Contact information section
 */
export function ContactInfoSection({ name, phone, address }: ContactInfoSectionProps) {
  if (!name && !phone && !address) return null

  const addressString = address
    ? [address.street, address.city, address.state, address.zip, address.country]
        .filter(Boolean)
        .join(', ')
    : null

  return (
    <div className="rounded bg-white/5 border border-white/10 p-3">
      <div className="text-xs font-medium mb-2">👤 Contact Information</div>
      <div className="grid md:grid-cols-2 gap-2 text-xs">
        {name && (
          <div><span className="opacity-70">Name: </span>{name}</div>
        )}
        {phone && (
          <div><span className="opacity-70">Phone: </span>{phone}</div>
        )}
        {addressString && (
          <div className="md:col-span-2">
            <span className="opacity-70">Address: </span>{addressString}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactInfoSection
