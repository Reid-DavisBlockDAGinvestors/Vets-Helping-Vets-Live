export interface BlacklistedAddress {
  address: string
  addedAt: string
  reason?: string
}

export interface ContractStatus {
  isPaused: boolean
  owner: string
  platformTreasury: string
  platformFeeBps: number
  bugBountyPool: string
  totalCampaigns: number
  chainId: number
  chainName: string
  contractVersion: string
  contractAddress: string
}

export interface SecurityAction {
  type: 'blacklist' | 'removeBlacklist' | 'pause' | 'unpause' | 'emergencyWithdraw'
  address?: string
  amount?: string
  reason?: string
}
