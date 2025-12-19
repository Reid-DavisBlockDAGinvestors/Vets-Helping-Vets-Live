/**
 * Test suite for multi-contract functionality
 * Tests V5/V6 contract routing, wallet queries, and admin features
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import {
  CONTRACT_REGISTRY,
  ContractVersion,
  getActiveContractVersion,
  getContractInfo,
  getContractAddress,
  getAllDeployedContracts,
  getMintableContracts,
  getVersionFromAddress,
  hasFeature,
  getContractByVersion
} from '../lib/contracts'

// Mock ethers for unit tests
vi.mock('ethers', () => {
  const MockContract = class {
    address: string
    constructor(address: string, abi: any, provider: any) {
      this.address = address
    }
  }
  return {
    ethers: {
      Contract: MockContract,
      JsonRpcProvider: () => ({}),
      FetchRequest: () => ({ setHeader: () => {} })
    }
  }
})

vi.mock('../lib/onchain', () => ({
  getProvider: vi.fn().mockReturnValue({})
}))

describe('Contract Registry', () => {
  describe('CONTRACT_REGISTRY', () => {
    it('should have V5 contract defined', () => {
      expect(CONTRACT_REGISTRY.v5).toBeDefined()
      expect(CONTRACT_REGISTRY.v5.address).toBe('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
      expect(CONTRACT_REGISTRY.v5.name).toBe('PatriotPledgeNFTV5')
    })

    it('should have V6 contract defined', () => {
      expect(CONTRACT_REGISTRY.v6).toBeDefined()
      expect(CONTRACT_REGISTRY.v6.address).toBe('0xaE54e4E8A75a81780361570c17b8660CEaD27053')
      expect(CONTRACT_REGISTRY.v6.name).toBe('PatriotPledgeNFTV6')
    })

    it('should mark V5 as inactive for new campaigns', () => {
      expect(CONTRACT_REGISTRY.v5.isActive).toBe(false)
    })

    it('should mark V6 as active for new campaigns', () => {
      expect(CONTRACT_REGISTRY.v6.isActive).toBe(true)
    })

    it('should mark both V5 and V6 as mintable', () => {
      expect(CONTRACT_REGISTRY.v5.isMintable).toBe(true)
      expect(CONTRACT_REGISTRY.v6.isMintable).toBe(true)
    })
  })

  describe('getActiveContractVersion', () => {
    it('should return v6 as the active version', () => {
      expect(getActiveContractVersion()).toBe('v6')
    })
  })

  describe('getContractInfo', () => {
    it('should return correct info for V5', () => {
      const info = getContractInfo('v5')
      expect(info.version).toBe('v5')
      expect(info.address).toContain('0x96bB')
    })

    it('should return correct info for V6', () => {
      const info = getContractInfo('v6')
      expect(info.version).toBe('v6')
      expect(info.address).toContain('0xaE54')
    })
  })

  describe('getContractAddress', () => {
    it('should return V5 address', () => {
      expect(getContractAddress('v5')).toBe('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
    })

    it('should return V6 address', () => {
      expect(getContractAddress('v6')).toBe('0xaE54e4E8A75a81780361570c17b8660CEaD27053')
    })

    it('should return empty string for undeployed versions', () => {
      expect(getContractAddress('v7')).toBe('')
    })
  })

  describe('getAllDeployedContracts', () => {
    it('should return only deployed contracts (with valid addresses)', () => {
      const deployed = getAllDeployedContracts()
      expect(deployed.length).toBeGreaterThanOrEqual(2)
      expect(deployed.every(c => c.address.length === 42)).toBe(true)
    })
  })

  describe('getMintableContracts', () => {
    it('should return V5 and V6 as mintable', () => {
      const mintable = getMintableContracts()
      const versions = mintable.map(c => c.version)
      expect(versions).toContain('v5')
      expect(versions).toContain('v6')
    })
  })

  describe('getVersionFromAddress', () => {
    it('should return v5 for V5 address', () => {
      expect(getVersionFromAddress('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')).toBe('v5')
    })

    it('should return v6 for V6 address', () => {
      expect(getVersionFromAddress('0xaE54e4E8A75a81780361570c17b8660CEaD27053')).toBe('v6')
    })

    it('should be case-insensitive', () => {
      expect(getVersionFromAddress('0x96bb4d907cc6f90e5677df7ad48cf3ad12915890')).toBe('v5')
    })

    it('should return null for unknown address', () => {
      expect(getVersionFromAddress('0x0000000000000000000000000000000000000000')).toBe(null)
    })
  })
})

describe('Contract Features', () => {
  describe('V5 Features', () => {
    it('should NOT have batch mint', () => {
      expect(hasFeature('v5', 'batchMint')).toBe(false)
    })

    it('should NOT have royalties', () => {
      expect(hasFeature('v5', 'royalties')).toBe(false)
    })

    it('should NOT have setTokenURI', () => {
      expect(hasFeature('v5', 'setTokenURI')).toBe(false)
    })

    it('should NOT have pausable', () => {
      expect(hasFeature('v5', 'pausable')).toBe(false)
    })
  })

  describe('V6 Features', () => {
    it('should have batch mint', () => {
      expect(hasFeature('v6', 'batchMint')).toBe(true)
    })

    it('should have royalties', () => {
      expect(hasFeature('v6', 'royalties')).toBe(true)
    })

    it('should have setTokenURI', () => {
      expect(hasFeature('v6', 'setTokenURI')).toBe(true)
    })

    it('should have pausable', () => {
      expect(hasFeature('v6', 'pausable')).toBe(true)
    })

    it('should have burnable', () => {
      expect(hasFeature('v6', 'burnable')).toBe(true)
    })

    it('should have freezable', () => {
      expect(hasFeature('v6', 'freezable')).toBe(true)
    })

    it('should have blacklist', () => {
      expect(hasFeature('v6', 'blacklist')).toBe(true)
    })

    it('should have soulbound', () => {
      expect(hasFeature('v6', 'soulbound')).toBe(true)
    })
  })
})

describe('Contract Instance Creation', () => {
  it('should create V5 contract instance', () => {
    const contract = getContractByVersion('v5')
    expect(contract).toBeDefined()
    expect(contract.address).toBe('0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890')
  })

  it('should create V6 contract instance', () => {
    const contract = getContractByVersion('v6')
    expect(contract).toBeDefined()
    expect(contract.address).toBe('0xaE54e4E8A75a81780361570c17b8660CEaD27053')
  })

  it('should throw error for undeployed version', () => {
    expect(() => getContractByVersion('v7')).toThrow('Contract v7 not deployed')
  })
})

describe('Multi-Contract Business Logic', () => {
  describe('New Submission Routing', () => {
    it('should route new submissions to active contract (V6)', () => {
      const activeVersion = getActiveContractVersion()
      const activeContract = getContractInfo(activeVersion)
      
      expect(activeVersion).toBe('v6')
      expect(activeContract.isActive).toBe(true)
    })
  })

  describe('Purchase Routing', () => {
    it('should allow purchases on V5 campaigns', () => {
      const v5 = getContractInfo('v5')
      expect(v5.isMintable).toBe(true)
    })

    it('should allow purchases on V6 campaigns', () => {
      const v6 = getContractInfo('v6')
      expect(v6.isMintable).toBe(true)
    })
  })

  describe('Dashboard Display', () => {
    it('should include both V5 and V6 in mintable contracts for wallet query', () => {
      const mintable = getMintableContracts()
      expect(mintable.length).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('Future Contract Support', () => {
  it('should have placeholder for V7-V10', () => {
    expect(CONTRACT_REGISTRY.v7).toBeDefined()
    expect(CONTRACT_REGISTRY.v8).toBeDefined()
    expect(CONTRACT_REGISTRY.v9).toBeDefined()
    expect(CONTRACT_REGISTRY.v10).toBeDefined()
  })

  it('should mark future versions as inactive and not mintable', () => {
    expect(CONTRACT_REGISTRY.v7.isActive).toBe(false)
    expect(CONTRACT_REGISTRY.v7.isMintable).toBe(false)
    expect(CONTRACT_REGISTRY.v8.isActive).toBe(false)
    expect(CONTRACT_REGISTRY.v9.isActive).toBe(false)
    expect(CONTRACT_REGISTRY.v10.isActive).toBe(false)
  })

  it('should have empty addresses for future versions', () => {
    expect(CONTRACT_REGISTRY.v7.address).toBe('')
    expect(CONTRACT_REGISTRY.v8.address).toBe('')
  })
})
