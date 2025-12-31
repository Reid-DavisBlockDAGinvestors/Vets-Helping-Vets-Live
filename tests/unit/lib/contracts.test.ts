/**
 * Unit Tests for Contract Registry
 * Tests the enhanced infinite version contract registry
 */

import {
  createVersion,
  getActiveContractVersion,
  getContractInfo,
  getContractAddress,
  getAllDeployedContracts,
  getMintableContracts,
  getRegisteredContractCount,
  getHighestVersion,
  registerContract,
  unregisterContract,
  type ContractVersion,
  type ContractInfo,
} from '@/lib/contracts'

describe('lib/contracts', () => {
  describe('createVersion', () => {
    it('should create version string from number', () => {
      expect(createVersion(5)).toBe('v5')
      expect(createVersion(6)).toBe('v6')
      expect(createVersion(100)).toBe('v100')
    })
  })

  describe('getActiveContractVersion', () => {
    it('should return the active contract version', () => {
      const version = getActiveContractVersion()
      expect(version).toMatch(/^v\d+$/)
    })

    it('should return v6 as default active version', () => {
      const version = getActiveContractVersion()
      expect(version).toBe('v6')
    })
  })

  describe('getContractInfo', () => {
    it('should return info for v5', () => {
      const info = getContractInfo('v5' as ContractVersion)
      expect(info).toBeDefined()
      expect(info?.version).toBe('v5')
      expect(info?.chainId).toBe(1043)
    })

    it('should return info for v6', () => {
      const info = getContractInfo('v6' as ContractVersion)
      expect(info).toBeDefined()
      expect(info?.version).toBe('v6')
      expect(info?.isActive).toBe(true)
    })

    it('should return undefined for unregistered version', () => {
      const info = getContractInfo('v999' as ContractVersion)
      expect(info).toBeUndefined()
    })
  })

  describe('getContractAddress', () => {
    it('should return address for v5', () => {
      const address = getContractAddress('v5' as ContractVersion)
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should return address for v6', () => {
      const address = getContractAddress('v6' as ContractVersion)
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    })

    it('should return empty string for unregistered version', () => {
      const address = getContractAddress('v999' as ContractVersion)
      expect(address).toBe('')
    })
  })

  describe('getAllDeployedContracts', () => {
    it('should return array of deployed contracts', () => {
      const contracts = getAllDeployedContracts()
      expect(Array.isArray(contracts)).toBe(true)
      expect(contracts.length).toBeGreaterThanOrEqual(2) // At least v5 and v6
    })

    it('should only include contracts with valid addresses', () => {
      const contracts = getAllDeployedContracts()
      contracts.forEach((c) => {
        expect(c.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
      })
    })
  })

  describe('getMintableContracts', () => {
    it('should return array of mintable contracts', () => {
      const contracts = getMintableContracts()
      expect(Array.isArray(contracts)).toBe(true)
      contracts.forEach((c) => {
        expect(c.isMintable).toBe(true)
      })
    })
  })

  describe('getRegisteredContractCount', () => {
    it('should return count of registered contracts', () => {
      const count = getRegisteredContractCount()
      expect(count).toBeGreaterThanOrEqual(2) // At least v5 and v6
    })
  })

  describe('getHighestVersion', () => {
    it('should return highest registered version number', () => {
      const highest = getHighestVersion()
      expect(highest).toBeGreaterThanOrEqual(6)
    })
  })

  describe('Contract Features', () => {
    it('v5 should have limited features', () => {
      const info = getContractInfo('v5' as ContractVersion)
      expect(info?.features.batchMint).toBe(false)
      expect(info?.features.royalties).toBe(false)
    })

    it('v6 should have full features', () => {
      const info = getContractInfo('v6' as ContractVersion)
      expect(info?.features.batchMint).toBe(true)
      expect(info?.features.royalties).toBe(true)
      expect(info?.features.pausable).toBe(true)
    })
  })

  describe('Dynamic Registration', () => {
    const testVersion = 'v999' as ContractVersion
    const testContract: ContractInfo = {
      version: testVersion,
      address: '0x1234567890123456789012345678901234567890',
      name: 'TestContract',
      chainId: 1043,
      isActive: false,
      isMintable: false,
      features: {
        batchMint: false,
        royalties: false,
        pausable: false,
        burnable: false,
        setTokenURI: false,
        freezable: false,
        blacklist: false,
        soulbound: false,
      },
      abi: [],
    }

    afterEach(() => {
      // Clean up test contract
      unregisterContract(testVersion)
    })

    it('should register a new contract', () => {
      registerContract(testContract)
      const info = getContractInfo(testVersion)
      expect(info).toBeDefined()
      expect(info?.name).toBe('TestContract')
    })

    it('should unregister a contract', () => {
      registerContract(testContract)
      const result = unregisterContract(testVersion)
      expect(result).toBe(true)
      expect(getContractInfo(testVersion)).toBeUndefined()
    })

    it('should return false when unregistering non-existent contract', () => {
      const result = unregisterContract('v888' as ContractVersion)
      expect(result).toBe(false)
    })
  })
})
