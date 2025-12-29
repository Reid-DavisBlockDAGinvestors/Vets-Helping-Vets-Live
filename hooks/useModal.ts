'use client'

import { useState, useCallback } from 'react'

/**
 * Modal state interface following ISP
 */
export interface ModalState<T = any> {
  isOpen: boolean
  data: T | null
}

/**
 * Modal actions interface following ISP
 */
export interface ModalActions<T = any> {
  open: (data?: T) => void
  close: () => void
  toggle: () => void
  setData: (data: T) => void
}

export type UseModalReturn<T = any> = ModalState<T> & ModalActions<T>

/**
 * Shared modal state hook - eliminates duplicated modal patterns
 * 
 * Replaces duplicated patterns in:
 * - AdminCampaignHub.tsx (editingCampaign, deletingCampaign, etc.)
 * - AdminSubmissions.tsx
 * - AdminUsers.tsx
 * - BugReportButton.tsx
 * 
 * Usage:
 * ```tsx
 * const editModal = useModal<Campaign>()
 * const deleteModal = useModal<Campaign>()
 * 
 * // Open with data
 * editModal.open(campaign)
 * 
 * // In component
 * {editModal.isOpen && (
 *   <EditModal 
 *     campaign={editModal.data} 
 *     onClose={editModal.close} 
 *   />
 * )}
 * ```
 */
export function useModal<T = any>(initialOpen = false): UseModalReturn<T> {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [data, setData] = useState<T | null>(null)

  const open = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData)
    }
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Optionally clear data after animation
    setTimeout(() => setData(null), 200)
  }, [])

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev)
  }, [])

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData,
  }
}

/**
 * Hook for managing multiple modals
 * 
 * Usage:
 * ```tsx
 * const modals = useModals(['edit', 'delete', 'approve'] as const)
 * 
 * modals.edit.open(campaign)
 * modals.delete.open(campaign)
 * ```
 */
export function useModals<K extends string>(
  modalNames: readonly K[]
): Record<K, UseModalReturn> {
  const [states, setStates] = useState<Record<K, ModalState>>(() => {
    const initial = {} as Record<K, ModalState>
    modalNames.forEach(name => {
      initial[name] = { isOpen: false, data: null }
    })
    return initial
  })

  const createActions = useCallback((name: K): ModalActions => ({
    open: (data?: any) => {
      setStates(prev => ({
        ...prev,
        [name]: { isOpen: true, data: data ?? prev[name].data }
      }))
    },
    close: () => {
      setStates(prev => ({
        ...prev,
        [name]: { ...prev[name], isOpen: false }
      }))
    },
    toggle: () => {
      setStates(prev => ({
        ...prev,
        [name]: { ...prev[name], isOpen: !prev[name].isOpen }
      }))
    },
    setData: (data: any) => {
      setStates(prev => ({
        ...prev,
        [name]: { ...prev[name], data }
      }))
    },
  }), [])

  const result = {} as Record<K, UseModalReturn>
  modalNames.forEach(name => {
    result[name] = {
      ...states[name],
      ...createActions(name),
    }
  })

  return result
}

/**
 * Confirmation modal hook with confirm/cancel pattern
 */
export interface UseConfirmModalReturn<T = any> extends UseModalReturn<T> {
  confirm: () => void
  isConfirming: boolean
  setConfirming: (confirming: boolean) => void
}

export function useConfirmModal<T = any>(
  onConfirm?: (data: T) => Promise<void> | void
): UseConfirmModalReturn<T> {
  const modal = useModal<T>()
  const [isConfirming, setIsConfirming] = useState(false)

  const confirm = useCallback(async () => {
    if (!modal.data || !onConfirm) return
    
    setIsConfirming(true)
    try {
      await onConfirm(modal.data)
      modal.close()
    } finally {
      setIsConfirming(false)
    }
  }, [modal, onConfirm])

  return {
    ...modal,
    confirm,
    isConfirming,
    setConfirming: setIsConfirming,
  }
}

export default useModal
