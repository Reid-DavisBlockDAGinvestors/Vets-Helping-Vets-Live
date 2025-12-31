'use client'

import { useState, useCallback, useTransition } from 'react'
import { logger } from '@/lib/logger'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface OptimisticState<T> {
  data: T | null
  previousData: T | null
  status: FormStatus
  error: string | null
}

interface UseOptimisticFormOptions<T, R> {
  onSubmit: (data: T) => Promise<R>
  onSuccess?: (result: R, data: T) => void
  onError?: (error: Error, data: T) => void
  onOptimisticUpdate?: (data: T) => void
  rollbackOnError?: boolean
  successMessage?: string
  errorMessage?: string
}

interface UseOptimisticFormReturn<T, R> {
  submit: (data: T) => Promise<R | null>
  reset: () => void
  status: FormStatus
  error: string | null
  isSubmitting: boolean
  isSuccess: boolean
  isError: boolean
  isPending: boolean
  optimisticData: T | null
}

/**
 * useOptimisticForm - Provides optimistic UI updates for form submissions
 * 
 * Features:
 * - Instant visual feedback before server response
 * - Automatic rollback on error
 * - Loading, success, and error states
 * - TypeScript-safe with generics
 * 
 * @example
 * const { submit, isSubmitting, error } = useOptimisticForm({
 *   onSubmit: async (data) => await api.createPost(data),
 *   onSuccess: (result) => toast.success('Post created!'),
 *   onOptimisticUpdate: (data) => addPostToList(data),
 *   rollbackOnError: true,
 * })
 */
export function useOptimisticForm<T, R = unknown>({
  onSubmit,
  onSuccess,
  onError,
  onOptimisticUpdate,
  rollbackOnError = true,
  successMessage,
  errorMessage = 'Something went wrong. Please try again.',
}: UseOptimisticFormOptions<T, R>): UseOptimisticFormReturn<T, R> {
  const [state, setState] = useState<OptimisticState<T>>({
    data: null,
    previousData: null,
    status: 'idle',
    error: null,
  })

  const [isPending, startTransition] = useTransition()

  const submit = useCallback(
    async (data: T): Promise<R | null> => {
      // Store previous data for potential rollback
      const previousData = state.data

      // Optimistic update - show the change immediately
      setState((prev) => ({
        ...prev,
        data,
        previousData,
        status: 'submitting',
        error: null,
      }))

      // Trigger optimistic callback
      if (onOptimisticUpdate) {
        startTransition(() => {
          onOptimisticUpdate(data)
        })
      }

      try {
        logger.debug('[OptimisticForm] Submitting...', { data })
        const result = await onSubmit(data)

        setState((prev) => ({
          ...prev,
          status: 'success',
          error: null,
        }))

        logger.debug('[OptimisticForm] Success', { result })

        if (onSuccess) {
          onSuccess(result, data)
        }

        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const message = error.message || errorMessage

        logger.error('[OptimisticForm] Error:', message)

        // Rollback to previous state if enabled
        if (rollbackOnError) {
          setState((prev) => ({
            ...prev,
            data: prev.previousData,
            status: 'error',
            error: message,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: message,
          }))
        }

        if (onError) {
          onError(error, data)
        }

        return null
      }
    },
    [onSubmit, onSuccess, onError, onOptimisticUpdate, rollbackOnError, errorMessage, state.data]
  )

  const reset = useCallback(() => {
    setState({
      data: null,
      previousData: null,
      status: 'idle',
      error: null,
    })
  }, [])

  return {
    submit,
    reset,
    status: state.status,
    error: state.error,
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    isPending,
    optimisticData: state.data,
  }
}

/**
 * useOptimisticList - Manages optimistic updates for list operations
 * 
 * @example
 * const { items, addItem, removeItem, updateItem } = useOptimisticList({
 *   initialItems: posts,
 *   onAdd: (item) => api.createPost(item),
 *   onRemove: (id) => api.deletePost(id),
 * })
 */
export function useOptimisticList<T extends { id: string | number }>({
  initialItems = [],
  onAdd,
  onRemove,
  onUpdate,
}: {
  initialItems?: T[]
  onAdd?: (item: Omit<T, 'id'>) => Promise<T>
  onRemove?: (id: T['id']) => Promise<void>
  onUpdate?: (id: T['id'], updates: Partial<T>) => Promise<T>
}) {
  const [items, setItems] = useState<T[]>(initialItems)
  const [pendingIds, setPendingIds] = useState<Set<T['id']>>(new Set())

  const addItem = useCallback(
    async (newItem: Omit<T, 'id'>) => {
      // Generate temporary ID for optimistic update
      const tempId = `temp-${Date.now()}` as T['id']
      const optimisticItem = { ...newItem, id: tempId } as T

      // Optimistically add to list
      setItems((prev) => [...prev, optimisticItem])
      setPendingIds((prev) => new Set(prev).add(tempId))

      try {
        if (onAdd) {
          const realItem = await onAdd(newItem)
          // Replace temp item with real item
          setItems((prev) =>
            prev.map((item) => (item.id === tempId ? realItem : item))
          )
        }
      } catch (err) {
        // Rollback on error
        setItems((prev) => prev.filter((item) => item.id !== tempId))
        throw err
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(tempId)
          return next
        })
      }
    },
    [onAdd]
  )

  const removeItem = useCallback(
    async (id: T['id']) => {
      // Store item for potential rollback
      const removedItem = items.find((item) => item.id === id)
      const removedIndex = items.findIndex((item) => item.id === id)

      // Optimistically remove from list
      setItems((prev) => prev.filter((item) => item.id !== id))
      setPendingIds((prev) => new Set(prev).add(id))

      try {
        if (onRemove) {
          await onRemove(id)
        }
      } catch (err) {
        // Rollback on error
        if (removedItem) {
          setItems((prev) => {
            const next = [...prev]
            next.splice(removedIndex, 0, removedItem)
            return next
          })
        }
        throw err
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [items, onRemove]
  )

  const updateItem = useCallback(
    async (id: T['id'], updates: Partial<T>) => {
      // Store original for rollback
      const originalItem = items.find((item) => item.id === id)

      // Optimistically update
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      )
      setPendingIds((prev) => new Set(prev).add(id))

      try {
        if (onUpdate) {
          const updatedItem = await onUpdate(id, updates)
          setItems((prev) =>
            prev.map((item) => (item.id === id ? updatedItem : item))
          )
        }
      } catch (err) {
        // Rollback on error
        if (originalItem) {
          setItems((prev) =>
            prev.map((item) => (item.id === id ? originalItem : item))
          )
        }
        throw err
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [items, onUpdate]
  )

  const isPending = useCallback(
    (id: T['id']) => pendingIds.has(id),
    [pendingIds]
  )

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    isPending,
    hasPendingItems: pendingIds.size > 0,
  }
}

/**
 * useOptimisticToggle - For like/follow/favorite type actions
 */
export function useOptimisticToggle({
  initialState = false,
  onToggle,
}: {
  initialState?: boolean
  onToggle: (newState: boolean) => Promise<void>
}) {
  const [isActive, setIsActive] = useState(initialState)
  const [isPending, setIsPending] = useState(false)

  const toggle = useCallback(async () => {
    const newState = !isActive

    // Optimistic update
    setIsActive(newState)
    setIsPending(true)

    try {
      await onToggle(newState)
    } catch (err) {
      // Rollback on error
      setIsActive(!newState)
      throw err
    } finally {
      setIsPending(false)
    }
  }, [isActive, onToggle])

  return {
    isActive,
    toggle,
    isPending,
    setIsActive,
  }
}
