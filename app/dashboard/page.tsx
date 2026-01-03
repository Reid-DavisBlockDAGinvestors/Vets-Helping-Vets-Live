"use client"

import { useEffect, useState } from 'react'
import { logger } from '@/lib/logger'
import Link from 'next/link'
import { useWallet } from '@/hooks/useWallet'
import { ipfsToHttp } from '@/lib/ipfs'
import { getCategoryById } from '@/lib/categories'
import ContractStatus from '@/components/ContractStatus'
import CampaignUpdateForm from '@/components/CampaignUpdateForm'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x96bB4d907CC6F90E5677df7ad48Cf3ad12915890'

// Chain-aware explorer URLs
const CHAIN_EXPLORERS: Record<number, string> = {
  1043: 'https://awakening.bdagscan.com',
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  8453: 'https://basescan.org',
}

function getExplorerUrl(chainId?: number): string {
  if (chainId && CHAIN_EXPLORERS[chainId]) {
    return CHAIN_EXPLORERS[chainId]
  }
  return CHAIN_EXPLORERS[1043] // Default to BlockDAG
}

type OwnedNFT = {
  tokenId: number
  campaignId: number
  submissionId: string | null
  editionNumber: number
  totalEditions: number
  editionsMinted: number
  contractAddress: string
  contractVersion: string
  chainId?: number
  chainName?: string
  title: string
  image: string
  category: string
  goal: number
  raised: number
  nftSalesUSD: number
  tipsUSD: number
  isCreator: boolean
}

type CreatedCampaign = {
  id: string
  campaignId: number | null
  title: string
  story: string
  category: string
  goal: number
  imageUri: string
  status: string
  raised: number
  nftSalesUSD: number
  tipsUSD: number
  editionsMinted: number
  maxEditions: number
  pendingUpdates: number
  canUpdate: boolean
  latestUpdate: any | null
  contractAddress?: string
  contractVersion?: string
  chainId?: number
  chainName?: string
  videoUrl?: string // YouTube video URL
}

export default function DashboardPage() {
  const { address, isConnected, connectAuto, balance, isOnBlockDAG } = useWallet()
  const [summary, setSummary] = useState<any>(null)
  const [ownedNfts, setOwnedNfts] = useState<OwnedNFT[]>([])
  const [createdCampaigns, setCreatedCampaigns] = useState<CreatedCampaign[]>([])
  const [loadingNfts, setLoadingNfts] = useState(false)
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [activeTab, setActiveTab] = useState<'owned' | 'created'>('owned')
  const [selectedCampaign, setSelectedCampaign] = useState<CreatedCampaign | null>(null)
  const [showUpdateForm, setShowUpdateForm] = useState(false)

  // Fetch platform summary
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch('/api/analytics/summary')
        if (res.ok) setSummary(await res.json())
      } catch {}
    }
    run()
  }, [])

  // Fetch owned NFTs when wallet connected
  useEffect(() => {
    if (!address) {
      setOwnedNfts([])
      return
    }
    const fetchOwned = async () => {
      setLoadingNfts(true)
      try {
        const res = await fetch(`/api/wallet/nfts?address=${address}`)
        if (res.ok) {
          const data = await res.json()
          setOwnedNfts(data.nfts || [])
        }
      } catch (e) {
        logger.error('Failed to fetch owned NFTs:', e)
      } finally {
        setLoadingNfts(false)
      }
    }
    fetchOwned()
  }, [address])

  // Fetch created campaigns when wallet connected
  useEffect(() => {
    if (!address) {
      setCreatedCampaigns([])
      return
    }
    const fetchCreated = async () => {
      setLoadingCampaigns(true)
      try {
        const res = await fetch(`/api/wallet/campaigns?address=${address}`)
        if (res.ok) {
          const data = await res.json()
          setCreatedCampaigns(data.campaigns || [])
        }
      } catch (e) {
        logger.error('Failed to fetch created campaigns:', e)
      } finally {
        setLoadingCampaigns(false)
      }
    }
    fetchCreated()
  }, [address])

  const handleUpdateClick = (campaign: CreatedCampaign) => {
    setSelectedCampaign(campaign)
    setShowUpdateForm(true)
  }

  const handleUpdateSubmitted = () => {
    setShowUpdateForm(false)
    setSelectedCampaign(null)
    // Refresh campaigns
    if (address) {
      fetch(`/api/wallet/campaigns?address=${address}`)
        .then(res => res.json())
        .then(data => setCreatedCampaigns(data.campaigns || []))
    }
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Your Dashboard</h1>
          <p className="mt-1 text-white/60">Track your NFTs, manage your fundraisers, and submit updates.</p>
        </div>
        
        {!isConnected ? (
          <button
            onClick={connectAuto}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/20"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-white/50">Connected</div>
              <div className="font-mono text-white/80 text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
              {balance && (
                <div className="text-xs text-white/40">
                  {Number(balance).toFixed(2)} BDAG
                </div>
              )}
            </div>
            <div className={`w-3 h-3 rounded-full ${isOnBlockDAG ? 'bg-green-500' : 'bg-yellow-500'}`} />
          </div>
        )}
      </div>

      {/* Not connected state */}
      {!isConnected && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h2 className="text-xl font-semibold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-white/60 max-w-md mx-auto">
            Connect your wallet to view your NFT collection, manage your fundraisers, and submit updates to your campaigns.
          </p>
        </div>
      )}

      {/* Connected state */}
      {isConnected && (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('owned')}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'owned'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              NFTs I Own ({ownedNfts.length})
            </button>
            <button
              onClick={() => setActiveTab('created')}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === 'created'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              My Fundraisers ({createdCampaigns.length})
            </button>
          </div>

          {/* NFTs I Own Tab */}
          {activeTab === 'owned' && (
            <div className="space-y-6">
              {loadingNfts ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-white/60">Loading your NFTs...</p>
                </div>
              ) : ownedNfts.length === 0 ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
                  <div className="text-5xl mb-4">🎨</div>
                  <h2 className="text-xl font-semibold text-white mb-2">No NFTs Yet</h2>
                  <p className="text-white/60 mb-6">You haven't purchased any fundraiser NFTs yet.</p>
                  <Link
                    href="/marketplace"
                    className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
                  >
                    Browse Marketplace
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ownedNfts.map((nft) => (
                    <Link
                      key={`${nft.contractAddress || 'v5'}-${nft.tokenId}`}
                      href={`/story/${nft.submissionId || nft.campaignId}`}
                      className="group block rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-white/20 hover:bg-white/10 transition-all"
                    >
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-900/50 to-purple-900/50">
                        {nft.image ? (
                          <img
                            src={ipfsToHttp(nft.image)}
                            alt={nft.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                            onError={(e) => {
                              // Hide broken image and show placeholder
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : null}
                        {/* Placeholder shown behind image or when image fails */}
                        <div className="absolute inset-0 flex items-center justify-center -z-10">
                          <span className="text-4xl opacity-30">🎖️</span>
                        </div>
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/50 backdrop-blur text-xs text-white">
                          Edition {nft.editionNumber}/{nft.totalEditions || '∞'}
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-white group-hover:text-blue-300 transition-colors line-clamp-1">
                          {nft.title}
                        </h3>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-white/50">Token #{nft.tokenId}</span>
                            <a
                              href={`${getExplorerUrl(nft.chainId)}/address/${nft.contractAddress || CONTRACT_ADDRESS}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title={`View on ${nft.chainName || 'blockchain'} (${nft.contractVersion || 'v5'})`}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs bg-${getCategoryById(nft.category)?.color || 'blue'}-500/20 text-${getCategoryById(nft.category)?.color || 'blue'}-300`}>
                            {getCategoryById(nft.category)?.emoji} {getCategoryById(nft.category)?.label || nft.category}
                          </span>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-white/60 mb-1">
                            <div className="flex flex-col">
                              <span>${nft.raised.toFixed(0)} raised</span>
                              {nft.raised > 0 && (
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-emerald-400">NFT: ${(nft.nftSalesUSD || 0).toFixed(0)}</span>
                                  <span className="text-purple-400">Tips: ${(nft.tipsUSD || 0).toFixed(0)}</span>
                                </div>
                              )}
                            </div>
                            <span>{nft.totalEditions > 0 ? Math.round((nft.editionsMinted / nft.totalEditions) * 100) : 0}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                              style={{ width: `${nft.totalEditions > 0 ? Math.min(100, (nft.editionsMinted / nft.totalEditions) * 100) : 0}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-white/40 mt-1">{nft.editionsMinted} / {nft.totalEditions} sold</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Fundraisers Tab */}
          {activeTab === 'created' && (
            <div className="space-y-6">
              {loadingCampaigns ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-white/60">Loading your fundraisers...</p>
                </div>
              ) : createdCampaigns.length === 0 ? (
                <div className="rounded-2xl bg-white/5 border border-white/10 p-12 text-center">
                  <div className="text-5xl mb-4">📝</div>
                  <h2 className="text-xl font-semibold text-white mb-2">No Fundraisers Yet</h2>
                  <p className="text-white/60 mb-6">You haven't created any fundraiser campaigns.</p>
                  <Link
                    href="/submit"
                    className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
                  >
                    Start a Fundraiser
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {createdCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
                    >
                      <div className="flex flex-col md:flex-row">
                        {/* Image */}
                        <div className="md:w-48 h-32 md:h-auto flex-shrink-0 relative bg-gradient-to-br from-blue-900/50 to-purple-900/50">
                          {campaign.imageUri ? (
                            <img
                              src={ipfsToHttp(campaign.imageUri)}
                              alt={campaign.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : null}
                          {/* Placeholder shown behind image or when image fails */}
                          <div className="absolute inset-0 flex items-center justify-center -z-10">
                            <span className="text-3xl opacity-30">🎖️</span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-lg text-white">{campaign.title}</h3>
                              <div className="mt-1 flex items-center gap-3 text-sm">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  campaign.status === 'approved'
                                    ? 'bg-green-500/20 text-green-300'
                                    : campaign.status === 'pending'
                                    ? 'bg-yellow-500/20 text-yellow-300'
                                    : 'bg-red-500/20 text-red-300'
                                }`}>
                                  {campaign.status}
                                </span>
                                {campaign.campaignId && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/40">Campaign #{campaign.campaignId}</span>
                                    <a
                                      href={`${getExplorerUrl(campaign.chainId)}/address/${campaign.contractAddress || CONTRACT_ADDRESS}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                                      title={`View on ${campaign.chainName || 'blockchain'} (${campaign.contractVersion || 'v5'})`}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                )}
                                {campaign.videoUrl && (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-300 flex items-center gap-1">
                                    📹 Video
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              {campaign.campaignId && (
                                <Link
                                  href={`/story/${campaign.campaignId}`}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-colors"
                                >
                                  View
                                </Link>
                              )}
                              {campaign.canUpdate && (
                                <button
                                  onClick={() => handleUpdateClick(campaign)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                                >
                                  Update Story
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-white/40">Raised</div>
                              <div className="font-semibold text-white">${campaign.raised.toFixed(0)}</div>
                              {campaign.raised > 0 && (
                                <div className="flex gap-2 text-[10px] mt-0.5">
                                  <span className="text-emerald-400">NFT: ${(campaign.nftSalesUSD || 0).toFixed(0)}</span>
                                  <span className="text-purple-400">Tips: ${(campaign.tipsUSD || 0).toFixed(0)}</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="text-xs text-white/40">Goal</div>
                              <div className="font-semibold text-white">${campaign.goal?.toLocaleString() || 0}</div>
                            </div>
                            <div>
                              <div className="text-xs text-white/40">NFTs Sold</div>
                              <div className="font-semibold text-white">
                                {campaign.editionsMinted}/{campaign.maxEditions || '∞'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-white/40">Progress</div>
                              <div className="font-semibold text-white">
                                {campaign.maxEditions > 0 ? Math.round((campaign.editionsMinted / campaign.maxEditions) * 100) : 0}%
                              </div>
                            </div>
                          </div>

                          {/* Progress bar - based on NFTs sold */}
                          <div className="mt-3">
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                                style={{ width: `${Math.min(100, campaign.maxEditions > 0 ? (campaign.editionsMinted / campaign.maxEditions) * 100 : 0)}%` }}
                              />
                            </div>
                          </div>

                          {/* Pending updates notice */}
                          {campaign.pendingUpdates > 0 && (
                            <div className="mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-300">
                              {campaign.pendingUpdates} update{campaign.pendingUpdates > 1 ? 's' : ''} pending review
                            </div>
                          )}

                          {/* Latest approved update */}
                          {campaign.latestUpdate && (
                            <div className="mt-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
                              <div className="text-blue-300 font-medium">Latest Update</div>
                              <div className="text-white/60 text-xs mt-1 line-clamp-2">
                                {campaign.latestUpdate.story_update || campaign.latestUpdate.funds_utilization}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Platform Stats */}
      <div className="mt-12 rounded-2xl bg-white/5 border border-white/10 p-6">
        <h2 className="font-semibold text-white mb-4">Platform Impact</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-bold text-white">${summary?.fundsRaised?.toLocaleString?.() || 0}</div>
            <div className="text-sm text-white/50">Funds Raised</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-bold text-white">{summary?.purchases?.toLocaleString?.() || 0}</div>
            <div className="text-sm text-white/50">Purchases</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-bold text-white">{summary?.mints?.toLocaleString?.() || 0}</div>
            <div className="text-sm text-white/50">NFTs Minted</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4">
            <div className="text-2xl font-bold text-white">{summary?.milestones?.toLocaleString?.() || 0}</div>
            <div className="text-sm text-white/50">Milestones</div>
          </div>
        </div>
      </div>

      {/* Contract Status */}
      <div className="mt-6">
        <ContractStatus />
      </div>

      {/* Update Form Modal */}
      {showUpdateForm && selectedCampaign && (
        <CampaignUpdateForm
          campaign={selectedCampaign}
          walletAddress={address || ''}
          onClose={() => {
            setShowUpdateForm(false)
            setSelectedCampaign(null)
          }}
          onSubmitted={handleUpdateSubmitted}
        />
      )}
    </div>
  )
}
