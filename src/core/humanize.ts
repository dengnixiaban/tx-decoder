/**
 * 把解码后的参数翻译成人话  ★ 这个项目最核心的部分
 *
 * 难点不在技术，在"怎么让非技术用户一眼看懂风险"。
 */
import { formatUnits } from 'viem'
import type { TokenMeta } from '../types'

/** 地址缩略 */
export function shortAddr(a: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : ''
}

/** 金额格式化（自动处理 decimals） */
function fmtAmount(v: bigint, token: TokenMeta | null): string {
  const dec = token?.decimals ?? 18
  const sym = token?.symbol ?? ''
  const n = Number(formatUnits(v, dec))
  // 大额用缩写，避免"115792089237316195423570985008687907853269984665640564039457"
  const pretty =
    n >= 1e12 ? n.toExponential(2)
    : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1e3 ? `${(n / 1e3).toFixed(2)}K`
    : n < 0.0001 && n > 0 ? n.toExponential(2)
    : n.toLocaleString('en-US', { maximumFractionDigits: 6 })
  return sym ? `${pretty} ${sym}` : pretty
}

/** 判断是不是"无限授权" */
export function isInfinite(amount: bigint): boolean {
  // maxUint256，或者大到离谱（很多项目用 uint256 最大值）
  return amount >= 2n ** 200n
}

export function humanize(
  method: string,
  args: readonly unknown[],
  token: TokenMeta | null,
  txValue: bigint,
): { text: string; confidence: 'high' | 'medium' | 'low' } {
  const a = args as any[]

  switch (method) {
    case 'transfer': {
      const [to, amount] = a
      return {
        text: `向 ${shortAddr(to)} 转账 ${fmtAmount(amount, token)}`,
        confidence: 'high',
      }
    }

    case 'approve': {
      const [spender, amount] = a
      if (isInfinite(amount)) {
        return {
          text: `将你的【全部 ${token?.symbol ?? '代币'}】无限期授权给 ${shortAddr(spender)}（无限授权）`,
          confidence: 'high',
        }
      }
      return {
        text: `授权 ${shortAddr(spender)} 最多可以花费你 ${fmtAmount(amount, token)}`,
        confidence: 'high',
      }
    }

    case 'transferFrom': {
      const [from, to, amount] = a
      return {
        text: `从 ${shortAddr(from)} 转 ${fmtAmount(amount, token)} 给 ${shortAddr(to)}`,
        confidence: 'high',
      }
    }

    case 'setApprovalForAll': {
      const [operator, approved] = a
      return {
        text: approved
          ? `将你的【全部 NFT】授权给 ${shortAddr(operator)}（由对方自由转走）`
          : `收回 ${shortAddr(operator)} 对你 NFT 的授权`,
        confidence: 'high',
      }
    }

    case 'safeTransferFrom': {
      const [, to, tokenId] = a
      return {
        text: `把 NFT #${tokenId?.toString()} 转给 ${shortAddr(to)}`,
        confidence: 'high',
      }
    }

    case 'deposit':
      return {
        text: `存入 ${fmtAmount(txValue, { symbol: 'ETH', decimals: 18 })} 换 WETH`,
        confidence: 'high',
      }

    case 'withdraw':
      return {
        text: `取出 ${fmtAmount(a[0], { symbol: 'WETH', decimals: 18 })} 换回 ETH`,
        confidence: 'high',
      }

    case 'swap':
      return {
        text: `在 DEX 上执行兑换（参数复杂，建议核对合约地址）`,
        confidence: 'medium',
      }

    default:
      return { text: `调用方法 ${method}`, confidence: 'low' }
  }
}

/** 纯 ETH 转账（calldata 为空） */
export function humanizePlainTransfer(to: string, value: bigint): string {
  const eth = formatUnits(value, 18)
  return `向 ${shortAddr(to)} 转账 ${Number(eth).toLocaleString('en-US', { maximumFractionDigits: 6 })} ETH`
}
