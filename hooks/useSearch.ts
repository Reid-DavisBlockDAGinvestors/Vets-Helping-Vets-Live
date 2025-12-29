'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'

/**
 * Search state interface following ISP
 */
export interface SearchState {
  query: string
  debouncedQuery: string
  isSearching: boolean
}

/**
 * Search actions interface following ISP
 */
export interface SearchActions {
  setQuery: (query: string) => void
  clearQuery: () => void
}

export type UseSearchReturn = SearchState & SearchActions

export interface UseSearchOptions {
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Minimum characters to trigger search */
  minChars?: number
  /** Callback when debounced query changes */
  onSearch?: (query: string) => void
}

/**
 * Shared search hook with debouncing - eliminates duplicated search patterns
 * 
 * Replaces duplicated patterns in:
 * - AdminCampaignHub.tsx (searchQuery state)
 * - AdminSubmissions.tsx
 * - AdminUsers.tsx
 * - UserAccountPortal.tsx
 * 
 * Usage:
 * ```tsx
 * const { query, debouncedQuery, setQuery, clearQuery } = useSearch({
 *   debounceMs: 300,
 *   onSearch: (q) => console.log('Searching:', q)
 * })
 * 
 * // Filter items with debounced query
 * const filtered = items.filter(item => 
 *   item.name.toLowerCase().includes(debouncedQuery.toLowerCase())
 * )
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const {
    debounceMs = 300,
    minChars = 0,
    onSearch,
  } = options

  const [query, setQueryState] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const onSearchRef = useRef(onSearch)

  // Update callback ref
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery)
    setIsSearching(true)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set up debounced update
    timeoutRef.current = setTimeout(() => {
      const effectiveQuery = newQuery.length >= minChars ? newQuery : ''
      setDebouncedQuery(effectiveQuery)
      setIsSearching(false)
      
      if (onSearchRef.current) {
        onSearchRef.current(effectiveQuery)
      }
    }, debounceMs)
  }, [debounceMs, minChars])

  const clearQuery = useCallback(() => {
    setQueryState('')
    setDebouncedQuery('')
    setIsSearching(false)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (onSearchRef.current) {
      onSearchRef.current('')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    query,
    debouncedQuery,
    isSearching,
    setQuery,
    clearQuery,
  }
}

/**
 * Filter state interface for complex filtering
 */
export interface FilterState<T extends Record<string, any>> {
  filters: T
  activeFilterCount: number
}

export interface FilterActions<T extends Record<string, any>> {
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void
  setFilters: (filters: Partial<T>) => void
  clearFilter: (key: keyof T) => void
  clearAllFilters: () => void
  resetFilters: () => void
}

export type UseFiltersReturn<T extends Record<string, any>> = FilterState<T> & FilterActions<T>

/**
 * Shared filters hook for complex filtering scenarios
 * 
 * Usage:
 * ```tsx
 * const { filters, setFilter, clearAllFilters, activeFilterCount } = useFilters({
 *   status: 'all',
 *   category: 'all',
 *   sortBy: 'recent'
 * })
 * ```
 */
export function useFilters<T extends Record<string, any>>(
  initialFilters: T
): UseFiltersReturn<T> {
  const [filters, setFiltersState] = useState<T>(initialFilters)
  const initialFiltersRef = useRef(initialFilters)

  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const clearFilter = useCallback((key: keyof T) => {
    setFiltersState(prev => ({
      ...prev,
      [key]: initialFiltersRef.current[key]
    }))
  }, [])

  const clearAllFilters = useCallback(() => {
    setFiltersState(initialFiltersRef.current)
  }, [])

  const resetFilters = clearAllFilters

  // Count active filters (excluding default values)
  const activeFilterCount = useMemo(() => {
    return Object.keys(filters).filter(key => 
      filters[key] !== initialFiltersRef.current[key] &&
      filters[key] !== 'all' &&
      filters[key] !== ''
    ).length
  }, [filters])

  return {
    filters,
    activeFilterCount,
    setFilter,
    setFilters,
    clearFilter,
    clearAllFilters,
    resetFilters,
  }
}

export default useSearch
