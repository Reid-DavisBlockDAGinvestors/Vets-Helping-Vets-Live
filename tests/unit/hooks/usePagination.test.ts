import { renderHook, act } from '@testing-library/react'
import { usePagination, paginateArray } from '@/hooks/usePagination'

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePagination())
    
    expect(result.current.page).toBe(1)
    expect(result.current.perPage).toBe(20)
    expect(result.current.totalItems).toBe(0)
    expect(result.current.totalPages).toBe(1)
  })

  it('should initialize with custom values', () => {
    const { result } = renderHook(() => 
      usePagination({ initialPage: 2, initialPerPage: 10 })
    )
    
    expect(result.current.page).toBe(2)
    expect(result.current.perPage).toBe(10)
  })

  it('should calculate totalPages correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPerPage: 10 }))
    
    act(() => {
      result.current.setTotalItems(45)
    })
    
    expect(result.current.totalPages).toBe(5)
  })

  it('should navigate to next page', () => {
    const { result } = renderHook(() => usePagination())
    
    act(() => {
      result.current.setTotalItems(100)
    })
    
    act(() => {
      result.current.nextPage()
    })
    
    expect(result.current.page).toBe(2)
  })

  it('should not go past last page', () => {
    const { result } = renderHook(() => usePagination({ initialPerPage: 10 }))
    
    act(() => {
      result.current.setTotalItems(25)
    })
    
    act(() => {
      result.current.setPage(3) // Last page
      result.current.nextPage()
    })
    
    expect(result.current.page).toBe(3)
  })

  it('should navigate to previous page', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }))
    
    act(() => {
      result.current.setTotalItems(100)
    })
    
    act(() => {
      result.current.prevPage()
    })
    
    expect(result.current.page).toBe(2)
  })

  it('should not go before first page', () => {
    const { result } = renderHook(() => usePagination())
    
    act(() => {
      result.current.prevPage()
    })
    
    expect(result.current.page).toBe(1)
  })

  it('should calculate start and end indices correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPerPage: 10 }))
    
    act(() => {
      result.current.setTotalItems(100)
    })
    
    act(() => {
      result.current.setPage(2)
    })
    
    expect(result.current.startIndex).toBe(10)
    expect(result.current.endIndex).toBe(20)
  })

  it('should reset page when changing perPage', () => {
    const { result } = renderHook(() => usePagination({ initialPage: 3 }))
    
    act(() => {
      result.current.setTotalItems(100)
    })
    
    act(() => {
      result.current.setPerPage(50)
    })
    
    expect(result.current.page).toBe(1)
    expect(result.current.perPage).toBe(50)
  })

  it('should calculate hasNextPage and hasPrevPage correctly', () => {
    const { result } = renderHook(() => usePagination({ initialPerPage: 10 }))
    
    act(() => {
      result.current.setTotalItems(30)
    })
    
    expect(result.current.hasPrevPage).toBe(false)
    expect(result.current.hasNextPage).toBe(true)
    
    act(() => {
      result.current.setPage(2)
    })
    
    expect(result.current.hasPrevPage).toBe(true)
    expect(result.current.hasNextPage).toBe(true)
    
    act(() => {
      result.current.setPage(3)
    })
    
    expect(result.current.hasPrevPage).toBe(true)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('should generate page numbers correctly', () => {
    const { result } = renderHook(() => 
      usePagination({ initialPerPage: 10, maxPageNumbers: 5 })
    )
    
    act(() => {
      result.current.setTotalItems(100)
    })
    
    act(() => {
      result.current.setPage(5)
    })
    
    expect(result.current.pageNumbers).toEqual([3, 4, 5, 6, 7])
  })

  it('should reset to initial values', () => {
    const { result } = renderHook(() => 
      usePagination({ initialPage: 1, initialPerPage: 20 })
    )
    
    act(() => {
      result.current.setPage(5)
      result.current.setPerPage(50)
    })
    
    act(() => {
      result.current.reset()
    })
    
    expect(result.current.page).toBe(1)
    expect(result.current.perPage).toBe(20)
  })
})

describe('paginateArray', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('should paginate first page correctly', () => {
    const result = paginateArray(items, 1, 3)
    
    expect(result.items).toEqual([1, 2, 3])
    expect(result.total).toBe(10)
  })

  it('should paginate second page correctly', () => {
    const result = paginateArray(items, 2, 3)
    
    expect(result.items).toEqual([4, 5, 6])
    expect(result.total).toBe(10)
  })

  it('should handle last partial page', () => {
    const result = paginateArray(items, 4, 3)
    
    expect(result.items).toEqual([10])
    expect(result.total).toBe(10)
  })

  it('should handle empty array', () => {
    const result = paginateArray([], 1, 10)
    
    expect(result.items).toEqual([])
    expect(result.total).toBe(0)
  })
})
