'use client'

/**
 * FormSection Component
 * 
 * Reusable section wrapper for form fields
 * Provides consistent styling and numbering
 */

import type { FormSectionProps } from './types'

export function FormSection({ 
  sectionNumber, 
  title, 
  subtitle, 
  children,
  variant = 'default' 
}: FormSectionProps) {
  const bgColor = variant === 'orange' ? 'bg-orange-500/20' : 'bg-blue-500/20'
  const textColor = variant === 'orange' ? 'text-orange-400' : 'text-blue-400'

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center ${textColor} font-bold`}>
          {sectionNumber}
        </div>
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/50">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default FormSection
