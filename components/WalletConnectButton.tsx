'use client'

import { useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'

export default function WalletConnectButton() {
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      (window as any).ethereum.on?.('accountsChanged', (accs: string[]) => setAccount(accs?.[0] ?? null))
    }
  }, [])

  const connect = async () => {
    if (!(window as any).ethereum) return alert('MetaMask not found')
    const provider = new BrowserProvider((window as any).ethereum)
    const accs = await provider.send('eth_requestAccounts', [])
    setAccount(accs?.[0] ?? null)
  }

  return (
    <button onClick={connect} className="rounded bg-patriotic-red px-3 py-2 text-white hover:opacity-90">
      {account ? account.slice(0,6) + '…' + account.slice(-4) : 'Connect Wallet'}
    </button>
  )
}
