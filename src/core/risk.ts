/**
 * 风险判定
 *
 * 分三档：high（会丢资产）、medium（看不清是什么）、low（常规操作）
 */
import type { RiskItem } from '../types'
import type { SelectorInfo } from './selectors'
import { isInfinite, shortAddr } from './humanize'

/* 已知合约标签（生产项目应该接 Etherscan / 自己的数据库） */
const KNOWN_CONTRACTS: Record<string, string> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC 代币合约',
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT 代币合约',
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'DAI 代币合约',
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'WETH 合约',
  '0x0000000000000000000000000000000000000000': '零地址（销毁）',
}

export function labelAddress(addr: string): string | null {
  return KNOWN_CONTRACTS[addr.toLowerCase()] ?? null
}

export function assessRisk(params: {
  selector: string
  info: SelectorInfo | null
  args: readonly unknown[] | null
  to: string | null
  value: bigint
  status: 'success' | 'reverted'
  txValue: bigint
}): RiskItem[] {
  const risks: RiskItem[] = []
  const { info, args, to } = params

  /* ---------- 高危 1：无限授权 ---------- */
  if (info?.method === 'approve' && args && isInfinite(args[1] as bigint)) {
    risks.push({
      level: 'high',
      reason: '无限授权',
      detail: `该地址可以随时转走你全部的代币，不需要你再次确认`,
    })
  }

  /* ---------- 高危 2：授权全部 NFT ---------- */
  if (info?.method === 'setApprovalForAll' && args && args[1] === true) {
    risks.push({
      level: 'high',
      reason: '授权全部 NFT',
      detail: `对方可以自由转走你钱包里的所有 NFT`,
    })
  }

  /* ---------- 高危 3：授权给零地址或自己 ---------- */
  if (info?.method === 'approve' && args) {
    const spender = String(args[0]).toLowerCase()
    if (spender === '0x0000000000000000000000000000000000000000') {
      risks.push({ level: 'medium', reason: '授权给了零地址', detail: '可能是误操作' })
    }
  }

  /* ---------- 中危：未知合约 ---------- */
  if (to && !KNOWN_CONTRACTS[to.toLowerCase()] && info) {
    risks.push({
      level: 'medium',
      reason: '未知合约',
      detail: `目标合约 ${shortAddr(to)} 不在已知列表中，无法确认其信誉`,
    })
  }

  /* ---------- 中危：无法识别的函数 ---------- */
  if (!info && params.selector !== '0x') {
    risks.push({
      level: 'medium',
      reason: '无法识别的方法',
      detail: `函数选择器 ${params.selector} 不在已知列表中，可能是新协议或恶意合约`,
    })
  }

  /* ---------- 提示：交易已失败 ---------- */
  if (params.status === 'reverted') {
    risks.push({
      level: 'low',
      reason: '这笔交易执行失败了',
      detail: '状态为 reverted，操作已回滚，但 gas 费已经扣除',
    })
  }

  /* ---------- 提示：纯 ETH 转账（calldata 为空才算） ---------- */
  // ⚠️ 必须同时判断 selector === '0x'：
  //    有 calldata 但没识别出来的交易，不能当成纯转账
  if (params.selector === '0x' && params.value > 0n) {
    risks.push({
      level: 'low',
      reason: '纯 ETH 转账',
      detail: '没有调用任何合约，只是转 ETH',
    })
  }

  return risks
}

export function overallLevel(risks: RiskItem[]): 'high' | 'medium' | 'low' | 'none' {
  if (risks.some(r => r.level === 'high')) return 'high'
  if (risks.some(r => r.level === 'medium')) return 'medium'
  if (risks.some(r => r.level === 'low')) return 'low'
  return 'none'
}
