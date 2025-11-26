"use client";

import { useEffect, useState } from "react";
import { BrowserProvider, JsonRpcProvider, Contract } from "ethers";

const DEFAULT_RPC = "https://rpc.awakening.bdagscan.com";
const ABI = [
  "function nextTokenId() view returns (uint256)",
  "function feeBps() view returns (uint96)",
  "function nonprofit() view returns (address)"
];

export type ContractStatus = {
  address: string | null;
  chainId: string | null;
  networkName: string | null;
  networkLabel: string | null;
  nextTokenId: string | null;
  feeBps: string | null;
  nonprofit: string | null;
  error: string | null;
  loading: boolean;
  wrongChain: boolean;
  explorerBase: string | null;
  switchNetwork?: () => Promise<void>;
};

export function useContractStatus(): ContractStatus {
  const [state, setState] = useState<ContractStatus>({
    address: null,
    chainId: null,
    networkName: null,
    networkLabel: null,
    nextTokenId: null,
    feeBps: null,
    nonprofit: null,
    error: null,
    loading: true,
    wrongChain: false,
    explorerBase: null,
  });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const addr = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null;
      if (!addr) {
        if (!cancelled) setState(s => ({ ...s, error: "NEXT_PUBLIC_CONTRACT_ADDRESS not set", loading: false }));
        return;
      }
      try {
        const hasWindow = typeof window !== "undefined";
        const browserProvider = hasWindow && (window as any).ethereum
          ? new BrowserProvider((window as any).ethereum)
          : null;
        const fallbackProvider = new JsonRpcProvider(DEFAULT_RPC);
        const provider = browserProvider ?? fallbackProvider;

        const net = await provider.getNetwork();
        const rpcChainHex = "0x" + BigInt(net.chainId).toString(16);
        let chainIdHex = rpcChainHex;
        if (hasWindow && (window as any).ethereum?.chainId) {
          chainIdHex = (window as any).ethereum.chainId;
        }

        const networkName = (net as any).name || chainIdHex;
        const expected = new Set(["0x413", "0xc7"]);
        const networkLabel = expected.has(chainIdHex.toLowerCase()) ? "BlockDAG Testnet (Awakening)" : "unknown";
        const wrongChain = !expected.has(chainIdHex.toLowerCase());
        const explorerBase = expected.has(chainIdHex.toLowerCase())
          ? (process.env.NEXT_PUBLIC_EXPLORER_BASE || "https://awakening.bdagscan.com")
          : null;

        // If wallet is on the wrong chain, read from RPC fallback to avoid BAD_DATA (empty result) errors
        const readProvider = wrongChain ? fallbackProvider : provider;
        const contract = new Contract(addr, ABI, readProvider);
        let nextId: any = null, feeBpsRaw: any = null, nonprofitAddr: string | null = null;
        try { nextId = await contract.nextTokenId(); } catch {}
        try { feeBpsRaw = await contract.feeBps(); } catch {}
        try { nonprofitAddr = await contract.nonprofit(); } catch {}

        if (!cancelled) setState({
          address: addr,
          chainId: chainIdHex,
          networkName,
          networkLabel,
          nextTokenId: nextId?.toString?.() ?? String(nextId),
          feeBps: feeBpsRaw?.toString?.() ?? String(feeBpsRaw),
          nonprofit: nonprofitAddr ?? null,
          error: null,
          loading: false,
          wrongChain,
          explorerBase,
          switchNetwork: async () => {
            if (!hasWindow || !(window as any).ethereum?.request) return;
            const eth = (window as any).ethereum;
            const targets = ["0xc7", "0x413"]; // prefer 0xc7, then 0x413
            for (const t of targets) {
              try {
                await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: t }] });
                return;
              } catch (e: any) {
                continue;
              }
            }
          },
        });
      } catch (e: any) {
        if (!cancelled) setState(s => ({ ...s, error: e?.message || "Failed to read contract", loading: false, address: addr }));
      }
    };
    run();
    return () => { cancelled = true };
  }, []);

  return state;
}
