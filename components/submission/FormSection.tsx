'use client'

import type { FormSectionProps } from './types'

/**
 * Reusable form section wrapper component
 */
export function FormSection({ 
  sectionNumber, 
  title, 
  description, 
  children 
}: FormSectionProps) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
          {sectionNumber}
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/50">{description}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default FormSection
