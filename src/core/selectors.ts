/**
 * 函数选择器对照表
 *
 * 函数选择器 = keccak256("函数名(参数类型)") 的前 4 字节
 * 它就在 calldata 的最前面，所以只看前 10 个字符就知道调的是什么方法。
 *
 * ⚠️ 下面的哈希值全部用 viem 的 toFunctionSelector 实际算出来的，不是手抄。
 */
import { erc20Abi, erc721Abi, wethAbi } from './abis'

export interface SelectorInfo {
  method: string
  signature: string
  category: 'erc20' | 'erc721' | 'weth' | 'dex' | 'other'
  abi: readonly any[]
  /** 是否为高危方法（授权类） */
  dangerous?: boolean
}

export const SELECTORS: Record<string, SelectorInfo> = {
  // ---------- ERC20 ----------
  '0xa9059cbb': { method: 'transfer',       signature: 'transfer(address,uint256)',              category: 'erc20', abi: erc20Abi },
  '0x095ea7b3': { method: 'approve',        signature: 'approve(address,uint256)',               category: 'erc20', abi: erc20Abi, dangerous: true },
  '0x23b872dd': { method: 'transferFrom',   signature: 'transferFrom(address,address,uint256)',  category: 'erc20', abi: erc20Abi },

  // ---------- ERC721 ----------
  '0xa22cb465': { method: 'setApprovalForAll', signature: 'setApprovalForAll(address,bool)',     category: 'erc721', abi: erc721Abi, dangerous: true },
  '0x42842e0e': { method: 'safeTransferFrom',  signature: 'safeTransferFrom(address,address,uint256)', category: 'erc721', abi: erc721Abi },

  // ---------- WETH ----------
  '0xd0e30db0': { method: 'deposit',  signature: 'deposit()',        category: 'weth', abi: wethAbi },
  '0x2e1a7d4d': { method: 'withdraw', signature: 'withdraw(uint256)', category: 'weth', abi: wethAbi },

  // ---------- DEX（只识别，不解码参数，因为各版本 ABI 不同）----------
  '0x128acb08': { method: 'swap', signature: 'swap(address,bool,int256,uint160,bytes)', category: 'dex', abi: [] },
}

/** 从 calldata 里取出选择器 */
export function getSelector(input: string): string {
  if (!input || input === '0x' || input.length < 10) return '0x'
  return input.slice(0, 10).toLowerCase()
}

/** 查表 */
export function lookupSelector(selector: string): SelectorInfo | null {
  return SELECTORS[selector.toLowerCase()] ?? null
}
