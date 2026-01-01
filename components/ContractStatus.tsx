'use client'

import { useContractStatus } from './useContractStatus'

export default function ContractStatus() {
  const status = useContractStatus()

  return (
    <div className="rounded border border-white/10 p-4">
      <h2 className="font-semibold">Contract Status</h2>
      {status.loading ? (
        <div className="mt-2 text-sm text-white/70">Loading…</div>
      ) : status.error ? (
        <div className="mt-2 text-sm text-red-400">Error: {status.error}</div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded bg-white/5 p-3 break-all">
              <span className="opacity-70">Address:</span><br />
              {status.explorerBase && status.address ? (
                <a className="underline" href={`${status.explorerBase}/address/${status.address}`} target="_blank" rel="noreferrer">{status.address}</a>
              ) : status.address}
            </div>
            <div className="rounded bg-white/5 p-3">
              <span className="opacity-70">Network:</span><br />
              {status.networkLabel || status.networkName} ({status.chainId})
            </div>
            <div className="rounded bg-white/5 p-3"><span className="opacity-70">nextTokenId:</span><br />{status.nextTokenId}</div>
            <div className="rounded bg-white/5 p-3"><span className="opacity-70">feeBps:</span><br />{status.feeBps}</div>
            <div className="rounded bg-white/5 p-3 break-all">
              <span className="opacity-70">nonprofit:</span><br />
              {status.explorerBase && status.nonprofit ? (
                <a className="underline" href={`${status.explorerBase}/address/${status.nonprofit}`} target="_blank" rel="noreferrer">{status.nonprofit}</a>
              ) : status.nonprofit}
            </div>
          </div>
          {status.wrongChain && (
            <div className="mt-3">
              <button
                className="rounded bg-patriotic-red px-3 py-2 text-white hover:opacity-90"
                onClick={() => status.switchNetwork?.()}
              >
                Switch Network to BlockDAG Mainnet
              </button>
            </div>
          )}
          <div className="mt-3 text-xs text-white/60">Reads via BrowserProvider if available, else BlockDAG RPC fallback.</div>
        </>
      )}
    </div>
  )
}
