/**
 * 支持的链
 *
 * 每条链需要：chainId、名字、RPC、区块浏览器
 * RPC 全部实测可用。踩过的坑：
 *   publicnode 的 Arbitrum / Optimism 节点不支持 eth_getTransactionReceipt
 *   （返回 Invalid parameters），所以这两条链改用官方 RPC。
 */
import {
  mainnet, base, arbitrum, optimism, sepolia, bsc,
} from 'viem/chains'

export interface ChainConfig {
  id: number
  name: string
  shortName: string
  rpc: string
  explorer: string
  /** 该链上是否支持 USDT/USDC 等标签 */
  viemChain: any
}

export const CHAINS: ChainConfig[] = [
  { id: mainnet.id,  name: 'Ethereum 主网', shortName: 'ETH',    rpc: 'https://ethereum-rpc.publicnode.com',        explorer: 'https://etherscan.io',          viemChain: mainnet },
  { id: base.id,     name: 'Base',          shortName: 'Base',   rpc: 'https://base-rpc.publicnode.com',            explorer: 'https://basescan.org',          viemChain: base },
  { id: arbitrum.id, name: 'Arbitrum One',  shortName: 'ARB',    rpc: 'https://arb1.arbitrum.io/rpc',    explorer: 'https://arbiscan.io',           viemChain: arbitrum },
  { id: optimism.id, name: 'Optimism',      shortName: 'OP',     rpc: 'https://mainnet.optimism.io',        explorer: 'https://optimistic.etherscan.io', viemChain: optimism },
  { id: sepolia.id,  name: 'Sepolia 测试网', shortName: 'Sepolia', rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io', viemChain: sepolia },
  { id: bsc.id,      name: 'BNB Chain',     shortName: 'BSC',    rpc: 'https://bsc-rpc.publicnode.com',             explorer: 'https://bscscan.com',           viemChain: bsc },
]

export function getChain(chainId: number): ChainConfig | undefined {
  return CHAINS.find(c => c.id === chainId)
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const c = getChain(chainId)
  return c ? `${c.explorer}/tx/${hash}` : '#'
}
