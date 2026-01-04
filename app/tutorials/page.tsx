import Link from 'next/link'

export const metadata = {
  title: 'Tutorials & Guides | PatriotPledge NFTs',
  description: 'Learn how to set up your wallet, connect to different blockchain networks, and purchase NFTs on PatriotPledge.',
}

export default function TutorialsPage() {
  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <section className="container py-12">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-8"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          📚 Tutorials & Guides
        </h1>
        <p className="text-lg text-white/60 max-w-2xl">
          Everything you need to know about purchasing NFTs and supporting campaigns on PatriotPledge.
        </p>
      </section>

      {/* Quick Start */}
      <section className="container mb-16">
        <div className="rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-8">
          <h2 className="text-2xl font-bold text-white mb-4">🚀 Quick Start</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm shrink-0">1</div>
              <div>
                <h3 className="font-semibold text-white">Install MetaMask</h3>
                <p className="text-sm text-white/60">Get the browser extension or mobile app</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">2</div>
              <div>
                <h3 className="font-semibold text-white">Connect Wallet</h3>
                <p className="text-sm text-white/60">Click &quot;Connect Wallet&quot; on any campaign</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-sm shrink-0">3</div>
              <div>
                <h3 className="font-semibold text-white">Purchase NFT</h3>
                <p className="text-sm text-white/60">Confirm the transaction in MetaMask</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Video Tutorial */}
      <section className="container mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">📺 Video Tutorial</h2>
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="aspect-video rounded-xl bg-black/50 overflow-hidden">
            <iframe
              src="https://www.youtube.com/embed/xkYcSQdnMXs"
              title="PatriotPledge NFTs Tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4">What You&apos;ll Learn</h3>
            <ul className="space-y-3 text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                How to install and set up MetaMask
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Adding custom networks to your wallet
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Purchasing your first NFT
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">✓</span>
                Viewing NFTs in your wallet
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Network Setup Guides */}
      <section className="container mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">🔗 Network Setup Guides</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Ethereum Mainnet */}
          <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-xl">💎</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Ethereum Mainnet</h3>
                <span className="text-xs text-green-400">LIVE · Real Funds</span>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Ethereum Mainnet is pre-configured in MetaMask. Just select it from the network dropdown.
            </p>
            <div className="bg-black/30 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Chain ID:</span>
                <span className="text-white">1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Currency:</span>
                <span className="text-white">ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Explorer:</span>
                <a href="https://etherscan.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">etherscan.io</a>
              </div>
            </div>
          </div>

          {/* BlockDAG Awakening Testnet */}
          <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center">
                <span className="text-xl">🧪</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">BlockDAG Awakening</h3>
                <span className="text-xs text-orange-400">TESTNET · Test Funds Only</span>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Add this network manually to test with free BDAG tokens.
            </p>
            <div className="bg-black/30 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Network Name:</span>
                <span className="text-white">BlockDAG Awakening</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">RPC URL:</span>
                <span className="text-green-400 text-xs">https://rpc.awakening.bdagscan.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Chain ID:</span>
                <span className="text-white">1043</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Currency:</span>
                <span className="text-white">BDAG</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Explorer:</span>
                <a href="https://awakening.bdagscan.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs">awakening.bdagscan.com</a>
              </div>
            </div>
            <a 
              href="https://awakening.bdagscan.com/faucet" 
              target="_blank" 
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-colors"
            >
              🚰 Get Free Test BDAG
            </a>
          </div>

          {/* Sepolia Testnet */}
          <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <span className="text-xl">🧪</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Sepolia Testnet</h3>
                <span className="text-xs text-orange-400">TESTNET · Test Funds Only</span>
              </div>
            </div>
            <p className="text-white/60 text-sm mb-4">
              Ethereum test network. Enable it in MetaMask settings under &quot;Show test networks&quot;.
            </p>
            <div className="bg-black/30 rounded-xl p-4 space-y-2 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Chain ID:</span>
                <span className="text-white">11155111</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Currency:</span>
                <span className="text-white">SepoliaETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Explorer:</span>
                <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">sepolia.etherscan.io</a>
              </div>
            </div>
          </div>

          {/* Coming Soon */}
          <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 border-dashed p-6 opacity-60">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-xl">🔜</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">More Networks Coming</h3>
                <span className="text-xs text-white/50">Polygon, Base, Arbitrum</span>
              </div>
            </div>
            <p className="text-white/60 text-sm">
              We&apos;re working on adding support for more networks to give you more options for supporting campaigns.
            </p>
          </div>
        </div>
      </section>

      {/* Step by Step Guide */}
      <section className="container mb-16">
        <h2 className="text-2xl font-bold text-white mb-6">📖 Step-by-Step Purchase Guide</h2>
        
        <div className="space-y-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold">1</div>
              <h3 className="text-xl font-semibold text-white">Install MetaMask</h3>
            </div>
            <p className="text-white/70 mb-4">
              Download and install the MetaMask browser extension or mobile app from{' '}
              <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">metamask.io</a>.
            </p>
            <p className="text-sm text-white/50">
              MetaMask is a secure wallet that lets you interact with blockchain applications. Create a new wallet or import an existing one.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">2</div>
              <h3 className="text-xl font-semibold text-white">Browse Campaigns</h3>
            </div>
            <p className="text-white/70 mb-4">
              Visit the <Link href="/marketplace" className="text-blue-400 hover:underline">Marketplace</Link> and find a campaign you&apos;d like to support.
            </p>
            <p className="text-sm text-white/50">
              Each campaign shows the chain it&apos;s on (💎 LIVE for mainnet, 🧪 for testnet), funds raised, and the creator&apos;s story.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">3</div>
              <h3 className="text-xl font-semibold text-white">Connect Your Wallet</h3>
            </div>
            <p className="text-white/70 mb-4">
              Click &quot;Connect Wallet&quot; on the campaign page. MetaMask will prompt you to approve the connection.
            </p>
            <p className="text-sm text-white/50">
              Make sure you&apos;re on the correct network for the campaign you want to support.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold">4</div>
              <h3 className="text-xl font-semibold text-white">Complete Purchase</h3>
            </div>
            <p className="text-white/70 mb-4">
              Select the number of NFTs you want to purchase, optionally add a tip, and click &quot;Purchase&quot;.
            </p>
            <p className="text-sm text-white/50">
              Confirm the transaction in MetaMask. Your NFT will appear in your wallet once the transaction is confirmed.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="container">
        <h2 className="text-2xl font-bold text-white mb-6">🔗 Quick Links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10">
            <span className="text-2xl">🦊</span>
            <span>Get MetaMask</span>
          </a>
          <a href="https://awakening.bdagscan.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10">
            <span className="text-2xl">🔍</span>
            <span>BlockDAG Explorer</span>
          </a>
          <a href="https://t.me/BlockDAGBuildathon" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10">
            <span className="text-2xl">💬</span>
            <span>Telegram Support</span>
          </a>
          <Link href="/marketplace" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-white/70 hover:text-white border border-white/10">
            <span className="text-2xl">🛒</span>
            <span>Marketplace</span>
          </Link>
        </div>
      </section>
    </div>
  )
}
