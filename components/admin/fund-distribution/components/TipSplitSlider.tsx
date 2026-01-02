'use client'

import { useState, useCallback } from 'react'
import type { TipSplitSliderProps } from '../types'

/**
 * TipSplitSlider - Slider component for configuring tip split percentages
 * Single responsibility: UI for adjusting submitter/nonprofit tip split
 */
export function TipSplitSlider({ value, onChange, disabled = false }: TipSplitSliderProps) {
  const [localValue, setLocalValue] = useState(value.submitterPercent)

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const submitterPercent = parseInt(e.target.value, 10)
    const nonprofitPercent = 100 - submitterPercent
    setLocalValue(submitterPercent)
    onChange({ submitterPercent, nonprofitPercent })
  }, [onChange])

  const handleInputChange = useCallback((field: 'submitter' | 'nonprofit', val: string) => {
    const parsed = parseInt(val, 10)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return
    
    const submitterPercent = field === 'submitter' ? parsed : 100 - parsed
    const nonprofitPercent = 100 - submitterPercent
    
    setLocalValue(submitterPercent)
    onChange({ submitterPercent, nonprofitPercent })
  }, [onChange])

  const presets = [
    { label: '100% Sub', submitter: 100 },
    { label: '70/30', submitter: 70 },
    { label: '50/50', submitter: 50 },
    { label: '100% NP', submitter: 0 },
  ]

  return (
    <div className="space-y-3" data-testid="tip-split-slider">
      {/* Slider */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-white/60">
          <span>Submitter</span>
          <span>Nonprofit</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={localValue}
          onChange={handleSliderChange}
          disabled={disabled}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="tip-split-range"
        />
      </div>

      {/* Visual Bar */}
      <div className="h-6 rounded-lg overflow-hidden flex">
        <div 
          className="bg-blue-500 flex items-center justify-center text-xs font-medium text-white transition-all"
          style={{ width: `${localValue}%` }}
        >
          {localValue > 15 && `${localValue}%`}
        </div>
        <div 
          className="bg-purple-500 flex items-center justify-center text-xs font-medium text-white transition-all"
          style={{ width: `${100 - localValue}%` }}
        >
          {100 - localValue > 15 && `${100 - localValue}%`}
        </div>
      </div>

      {/* Number Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-white/50 mb-1">Submitter %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={localValue}
            onChange={(e) => handleInputChange('submitter', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-blue-500 focus:outline-none disabled:opacity-50"
            data-testid="submitter-input"
          />
        </div>
        <div>
          <label className="block text-xs text-white/50 mb-1">Nonprofit %</label>
          <input
            type="number"
            min="0"
            max="100"
            value={100 - localValue}
            onChange={(e) => handleInputChange('nonprofit', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500 focus:outline-none disabled:opacity-50"
            data-testid="nonprofit-input"
          />
        </div>
      </div>

      {/* Presets */}
      <div className="flex gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setLocalValue(preset.submitter)
              onChange({ submitterPercent: preset.submitter, nonprofitPercent: 100 - preset.submitter })
            }}
            disabled={disabled}
            className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
              localValue === preset.submitter
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            data-testid={`preset-${preset.submitter}`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Total Validation */}
      <p className="text-xs text-white/40 text-center">
        Total: {localValue + (100 - localValue)}% {localValue + (100 - localValue) !== 100 && '⚠️ Must equal 100%'}
      </p>
    </div>
  )
}

export default TipSplitSlider
