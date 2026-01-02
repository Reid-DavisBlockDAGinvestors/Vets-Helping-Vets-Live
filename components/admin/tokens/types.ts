export interface TokenInfo {
  tokenId: number
  campaignId: number
  campaignTitle: string
  owner: string
  editionNumber: number
  tokenURI: string
  isFrozen: boolean
  isSoulbound: boolean
  chainId: number
  chainName: string
  contractVersion: string
  mintedAt?: string
}

export interface TokenFilters {
  campaignId?: number
  chainId?: number
  frozen?: boolean
  soulbound?: boolean
  owner?: string
}

export interface TokenAction {
  type: 'freeze' | 'unfreeze' | 'soulbound' | 'removeSoulbound' | 'burn' | 'fixUri'
  tokenId: number
  newUri?: string
}

export interface BatchTokenAction {
  type: 'freeze' | 'unfreeze'
  tokenIds: number[]
}
