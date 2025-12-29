import { renderHook, act, waitFor } from '@testing-library/react'
import { useSearch, useFilters } from '@/hooks/useSearch'

// Mock timers for debounce testing
jest.useFakeTimers()

describe('useSearch', () => {
  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should initialize with empty query', () => {
    const { result } = renderHook(() => useSearch())
    
    expect(result.current.query).toBe('')
    expect(result.current.debouncedQuery).toBe('')
    expect(result.current.isSearching).toBe(false)
  })

  it('should update query immediately', () => {
    const { result } = renderHook(() => useSearch())
    
    act(() => {
      result.current.setQuery('test')
    })
    
    expect(result.current.query).toBe('test')
    expect(result.current.isSearching).toBe(true)
  })

  it('should debounce the query update', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 300 }))
    
    act(() => {
      result.current.setQuery('test')
    })
    
    expect(result.current.debouncedQuery).toBe('')
    
    act(() => {
      jest.advanceTimersByTime(300)
    })
    
    expect(result.current.debouncedQuery).toBe('test')
    expect(result.current.isSearching).toBe(false)
  })

  it('should respect minChars option', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 0, minChars: 3 }))
    
    act(() => {
      result.current.setQuery('te')
      jest.runAllTimers()
    })
    
    expect(result.current.debouncedQuery).toBe('')
    
    act(() => {
      result.current.setQuery('test')
      jest.runAllTimers()
    })
    
    expect(result.current.debouncedQuery).toBe('test')
  })

  it('should call onSearch callback', () => {
    const onSearch = jest.fn()
    const { result } = renderHook(() => useSearch({ debounceMs: 0, onSearch }))
    
    act(() => {
      result.current.setQuery('test')
      jest.runAllTimers()
    })
    
    expect(onSearch).toHaveBeenCalledWith('test')
  })

  it('should clear query', () => {
    const onSearch = jest.fn()
    const { result } = renderHook(() => useSearch({ debounceMs: 0, onSearch }))
    
    act(() => {
      result.current.setQuery('test')
      jest.runAllTimers()
    })
    
    act(() => {
      result.current.clearQuery()
    })
    
    expect(result.current.query).toBe('')
    expect(result.current.debouncedQuery).toBe('')
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('should cancel pending debounce on new input', () => {
    const { result } = renderHook(() => useSearch({ debounceMs: 300 }))
    
    act(() => {
      result.current.setQuery('first')
    })
    
    act(() => {
      jest.advanceTimersByTime(150)
    })
    
    act(() => {
      result.current.setQuery('second')
    })
    
    act(() => {
      jest.advanceTimersByTime(300)
    })
    
    expect(result.current.debouncedQuery).toBe('second')
  })
})

describe('useFilters', () => {
  const initialFilters = {
    status: 'all',
    category: 'all',
    sortBy: 'recent',
  }

  it('should initialize with initial filters', () => {
    const { result } = renderHook(() => useFilters(initialFilters))
    
    expect(result.current.filters).toEqual(initialFilters)
    expect(result.current.activeFilterCount).toBe(0)
  })

  it('should set individual filter', () => {
    const { result } = renderHook(() => useFilters(initialFilters))
    
    act(() => {
      result.current.setFilter('status', 'pending')
    })
    
    expect(result.current.filters.status).toBe('pending')
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('should set multiple filters at once', () => {
    const { result } = renderHook(() => useFilters(initialFilters))
    
    act(() => {
      result.current.setFilters({ status: 'pending', category: 'veteran' })
    })
    
    expect(result.current.filters.status).toBe('pending')
    expect(result.current.filters.category).toBe('veteran')
    expect(result.current.activeFilterCount).toBe(2)
  })

  it('should clear individual filter', () => {
    const { result } = renderHook(() => useFilters(initialFilters))
    
    act(() => {
      result.current.setFilter('status', 'pending')
      result.current.setFilter('category', 'veteran')
    })
    
    act(() => {
      result.current.clearFilter('status')
    })
    
    expect(result.current.filters.status).toBe('all')
    expect(result.current.filters.category).toBe('veteran')
    expect(result.current.activeFilterCount).toBe(1)
  })

  it('should clear all filters', () => {
    const { result } = renderHook(() => useFilters(initialFilters))
    
    act(() => {
      result.current.setFilters({ status: 'pending', category: 'veteran', sortBy: 'goal' })
    })
    
    act(() => {
      result.current.clearAllFilters()
    })
    
    expect(result.current.filters).toEqual(initialFilters)
    expect(result.current.activeFilterCount).toBe(0)
  })
})
