/**
 * Unit Tests for Optimistic UI Hooks
 * Tests useOptimisticForm, useOptimisticList, useOptimisticToggle
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { 
  useOptimisticForm, 
  useOptimisticList, 
  useOptimisticToggle 
} from '@/hooks/useOptimisticForm'

describe('useOptimisticForm', () => {
  it('should start with idle status', () => {
    const { result } = renderHook(() =>
      useOptimisticForm({
        onSubmit: async () => ({ success: true }),
      })
    )

    expect(result.current.status).toBe('idle')
    expect(result.current.isSubmitting).toBe(false)
    expect(result.current.isSuccess).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle successful submission', async () => {
    const onSubmit = jest.fn().mockResolvedValue({ id: 1 })
    const onSuccess = jest.fn()

    const { result } = renderHook(() =>
      useOptimisticForm({
        onSubmit,
        onSuccess,
      })
    )

    await act(async () => {
      await result.current.submit({ name: 'Test' })
    })

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Test' })
    expect(onSuccess).toHaveBeenCalledWith({ id: 1 }, { name: 'Test' })
    expect(result.current.status).toBe('success')
    expect(result.current.isSuccess).toBe(true)
  })

  it('should handle submission error', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Network error'))
    const onError = jest.fn()

    const { result } = renderHook(() =>
      useOptimisticForm({
        onSubmit,
        onError,
      })
    )

    await act(async () => {
      await result.current.submit({ name: 'Test' })
    })

    expect(onError).toHaveBeenCalled()
    expect(result.current.status).toBe('error')
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe('Network error')
  })

  it('should call optimistic update callback', async () => {
    const onOptimisticUpdate = jest.fn()

    const { result } = renderHook(() =>
      useOptimisticForm({
        onSubmit: async () => ({}),
        onOptimisticUpdate,
      })
    )

    await act(async () => {
      await result.current.submit({ name: 'Test' })
    })

    expect(onOptimisticUpdate).toHaveBeenCalledWith({ name: 'Test' })
  })

  it('should reset state', async () => {
    const { result } = renderHook(() =>
      useOptimisticForm({
        onSubmit: async () => ({ success: true }),
      })
    )

    await act(async () => {
      await result.current.submit({ name: 'Test' })
    })

    expect(result.current.status).toBe('success')

    act(() => {
      result.current.reset()
    })

    expect(result.current.status).toBe('idle')
    expect(result.current.error).toBeNull()
  })
})

describe('useOptimisticList', () => {
  const initialItems = [
    { id: '1', name: 'Item 1' },
    { id: '2', name: 'Item 2' },
  ]

  it('should initialize with items', () => {
    const { result } = renderHook(() =>
      useOptimisticList({ initialItems })
    )

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].name).toBe('Item 1')
  })

  it('should add item optimistically', async () => {
    const onAdd = jest.fn().mockResolvedValue({ id: '3', name: 'Item 3' })

    const { result } = renderHook(() =>
      useOptimisticList({ initialItems, onAdd })
    )

    await act(async () => {
      await result.current.addItem({ name: 'Item 3' })
    })

    expect(result.current.items).toHaveLength(3)
    expect(result.current.items[2].name).toBe('Item 3')
  })

  it('should remove item optimistically', async () => {
    const onRemove = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useOptimisticList({ initialItems, onRemove })
    )

    await act(async () => {
      await result.current.removeItem('1')
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].id).toBe('2')
  })

  it('should rollback on remove error', async () => {
    const onRemove = jest.fn().mockRejectedValue(new Error('Delete failed'))

    const { result } = renderHook(() =>
      useOptimisticList({ initialItems, onRemove })
    )

    await expect(
      act(async () => {
        await result.current.removeItem('1')
      })
    ).rejects.toThrow('Delete failed')

    // Should rollback
    expect(result.current.items).toHaveLength(2)
  })

  it('should update item optimistically', async () => {
    const onUpdate = jest.fn().mockResolvedValue({ id: '1', name: 'Updated Item' })

    const { result } = renderHook(() =>
      useOptimisticList({ initialItems, onUpdate })
    )

    await act(async () => {
      await result.current.updateItem('1', { name: 'Updated Item' })
    })

    expect(result.current.items[0].name).toBe('Updated Item')
  })

  it('should track pending items', async () => {
    let resolvePromise: (value: any) => void
    const onRemove = jest.fn().mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve })
    )

    const { result } = renderHook(() =>
      useOptimisticList({ initialItems, onRemove })
    )

    // Start remove but don't await
    act(() => {
      result.current.removeItem('1')
    })

    expect(result.current.isPending('1')).toBe(true)
    expect(result.current.hasPendingItems).toBe(true)

    // Resolve
    await act(async () => {
      resolvePromise!(undefined)
    })

    await waitFor(() => {
      expect(result.current.isPending('1')).toBe(false)
    })
  })
})

describe('useOptimisticToggle', () => {
  it('should initialize with state', () => {
    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle: async () => {},
      })
    )

    expect(result.current.isActive).toBe(false)
    expect(result.current.isPending).toBe(false)
  })

  it('should toggle state optimistically', async () => {
    const onToggle = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle,
      })
    )

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.isActive).toBe(true)
    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('should toggle back on second call', async () => {
    const onToggle = jest.fn().mockResolvedValue(undefined)

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle,
      })
    )

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.isActive).toBe(true)

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.isActive).toBe(false)
    expect(onToggle).toHaveBeenCalledTimes(2)
  })

  it('should rollback on error', async () => {
    const onToggle = jest.fn().mockRejectedValue(new Error('Failed'))

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle,
      })
    )

    await expect(
      act(async () => {
        await result.current.toggle()
      })
    ).rejects.toThrow('Failed')

    // Should rollback to original state
    expect(result.current.isActive).toBe(false)
  })

  it('should track pending state', async () => {
    let resolvePromise: () => void
    const onToggle = jest.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolvePromise = resolve })
    )

    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle,
      })
    )

    // Start toggle but don't await
    act(() => {
      result.current.toggle()
    })

    expect(result.current.isPending).toBe(true)

    // Resolve
    await act(async () => {
      resolvePromise!()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })

  it('should allow manual state setting', () => {
    const { result } = renderHook(() =>
      useOptimisticToggle({
        initialState: false,
        onToggle: async () => {},
      })
    )

    act(() => {
      result.current.setIsActive(true)
    })

    expect(result.current.isActive).toBe(true)
  })
})
