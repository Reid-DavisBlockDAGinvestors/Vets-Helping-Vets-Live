'use client'

import { useState, useCallback, useMemo } from 'react'

/**
 * Pagination state interface following ISP
 */
export interface PaginationState {
  page: number
  perPage: number
  totalItems: number
  totalPages: number
}

/**
 * Pagination actions interface following ISP
 */
export interface PaginationActions {
  setPage: (page: number) => void
  nextPage: () => void
  prevPage: () => void
  setPerPage: (perPage: number) => void
  setTotalItems: (total: number) => void
  reset: () => void
}

/**
 * Pagination computed values interface
 */
export interface PaginationComputed {
  startIndex: number
  endIndex: number
  hasNextPage: boolean
  hasPrevPage: boolean
  pageNumbers: number[]
}

export type UsePaginationReturn = PaginationState & PaginationActions & PaginationComputed

export interface UsePaginationOptions {
  initialPage?: number
  initialPerPage?: number
  maxPageNumbers?: number
}

/**
 * Shared pagination hook - eliminates duplicated pagination logic
 * 
 * Replaces duplicated patterns in:
 * - AdminCampaignHub.tsx
 * - AdminSubmissions.tsx
 * - AdminUsers.tsx
 * - UserAccountPortal.tsx
 * 
 * Usage:
 * ```tsx
 * const {
 *   page, perPage, totalPages,
 *   setPage, nextPage, prevPage,
 *   hasNextPage, hasPrevPage, pageNumbers
 * } = usePagination({ initialPerPage: 20 })
 * 
 * // Paginate data
 * const paginatedItems = items.slice(startIndex, endIndex)
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    initialPage = 1,
    initialPerPage = 20,
    maxPageNumbers = 5,
  } = options

  const [page, setPageState] = useState(initialPage)
  const [perPage, setPerPageState] = useState(initialPerPage)
  const [totalItems, setTotalItems] = useState(0)

  const totalPages = useMemo(() => 
    Math.max(1, Math.ceil(totalItems / perPage)),
    [totalItems, perPage]
  )

  const setPage = useCallback((newPage: number) => {
    setPageState(Math.max(1, Math.min(newPage, totalPages)))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setPageState(prev => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPageState(prev => Math.max(prev - 1, 1))
  }, [])

  const setPerPage = useCallback((newPerPage: number) => {
    setPerPageState(newPerPage)
    setPageState(1) // Reset to first page when changing page size
  }, [])

  const reset = useCallback(() => {
    setPageState(initialPage)
    setPerPageState(initialPerPage)
  }, [initialPage, initialPerPage])

  // Computed values
  const startIndex = (page - 1) * perPage
  const endIndex = startIndex + perPage
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  // Generate page numbers for pagination UI
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const halfMax = Math.floor(maxPageNumbers / 2)
    
    let start = Math.max(1, page - halfMax)
    let end = Math.min(totalPages, start + maxPageNumbers - 1)
    
    // Adjust start if we're near the end
    if (end - start + 1 < maxPageNumbers) {
      start = Math.max(1, end - maxPageNumbers + 1)
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    return pages
  }, [page, totalPages, maxPageNumbers])

  return {
    // State
    page,
    perPage,
    totalItems,
    totalPages,
    // Actions
    setPage,
    nextPage,
    prevPage,
    setPerPage,
    setTotalItems,
    reset,
    // Computed
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
    pageNumbers,
  }
}

/**
 * Helper to paginate an array client-side
 */
export function paginateArray<T>(
  items: T[],
  page: number,
  perPage: number
): { items: T[]; total: number } {
  const start = (page - 1) * perPage
  return {
    items: items.slice(start, start + perPage),
    total: items.length,
  }
}

export default usePagination
