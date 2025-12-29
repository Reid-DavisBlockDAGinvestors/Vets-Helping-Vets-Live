/**
 * PatriotPledge Shared Hooks
 * 
 * This module exports all shared hooks following ISP principles.
 * Each hook is focused on a single responsibility and can be composed together.
 * 
 * @module hooks
 */

// Authentication
export { useAuth, useAccessToken, useAuthCheck } from './useAuth'
export type { AuthState, AuthActions, UseAuthReturn } from './useAuth'

export { useAdminAuth, useAdminApi } from './useAdminAuth'
export type { AdminAuthState, AdminAuthActions, UseAdminAuthReturn } from './useAdminAuth'

// Data Fetching
export { useAsyncData, useAuthenticatedData } from './useAsyncData'
export type { AsyncDataState, AsyncDataActions, UseAsyncDataReturn, UseAsyncDataOptions } from './useAsyncData'

// Pagination
export { usePagination, paginateArray } from './usePagination'
export type { 
  PaginationState, 
  PaginationActions, 
  PaginationComputed, 
  UsePaginationReturn,
  UsePaginationOptions 
} from './usePagination'

// Search & Filters
export { useSearch, useFilters } from './useSearch'
export type { 
  SearchState, 
  SearchActions, 
  UseSearchReturn,
  UseSearchOptions,
  FilterState,
  FilterActions,
  UseFiltersReturn
} from './useSearch'

// Modal State
export { useModal, useModals, useConfirmModal } from './useModal'
export type { 
  ModalState, 
  ModalActions, 
  UseModalReturn,
  UseConfirmModalReturn
} from './useModal'

// Wallet (existing)
export { useWallet } from './useWallet'
export type { WalletState } from './useWallet'
