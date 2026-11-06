/**
 * 交易模拟 / 当前状态回查
 *
 * 这里要非常诚实地说清楚一件事：
 *
 *   ❌ 我们【无法】在交易发生时的历史状态上重放执行 ——
 *      那需要 archive 节点（公共 RPC 一般只保留最近 128 个区块的状态）。
 *
 *   ✅ 我们能做的是：查这笔交易【造成的当前结果】。
 *      比如 approve 交易 → 这个授权现在还在不在、额度多少。
 *
 * 这才是用户真正关心的：「我现在还有没有这个风险」。
 */
import { formatUnits, type PublicClient } from 'viem'
import { erc20Abi } from './abis'
import { isInfinite } from './humanize'
import type { ParsedTx } from '../types'

export interface SimulationItem {
  label: string
  value: string
  tone: 'danger' | 'warn' | 'safe' | 'neutral'
}

export async function simulate(parsed: ParsedTx, client: PublicClient): Promise<SimulationItem[]> {
  const out: SimulationItem[] = []
  const d = parsed.decoded
  if (!d || !d.args || !parsed.to) return out

  const args = d.args as any[]
  const token = parsed.to
  const owner = parsed.from

  try {
    switch (d.method) {
      /* ---------- approve：查当前额度 ---------- */
      case 'approve': {
        const spender = args[0] as `0x${string}`
        const allowance = (await client.readContract({
          address: token, abi: erc20Abi, functionName: 'allowance',
          args: [owner, spender],
        })) as bigint

        const dec = parsed.token?.decimals ?? 18
        const sym = parsed.token?.symbol ?? '代币'

        if (allowance === 0n) {
          out.push({
            label: '当前授权额度',
            value: '0（已撤销 / 从未生效）',
            tone: 'safe',
          })
        } else if (isInfinite(allowance)) {
          out.push({
            label: '当前授权额度',
            value: `⚠️ 无限 —— ${spender} 仍可转走你全部的 ${sym}`,
            tone: 'danger',
          })
        } else {
          out.push({
            label: '当前授权额度',
            value: `${formatUnits(allowance, dec)} ${sym}（仍在生效）`,
            tone: 'warn',
          })
        }
        break
      }

      /* ---------- setApprovalForAll：查是否仍然授权 ---------- */
      case 'setApprovalForAll': {
        const operator = args[0] as `0x${string}`

        // ERC721 的 isApprovedForAll 不在 erc20Abi 里，内联一个最小 ABI
        const isAll = (await client.readContract({
          address: token,
          abi: [{
            name: 'isApprovedForAll', type: 'function', stateMutability: 'view',
            inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }],
            outputs: [{ type: 'bool' }],
          }] as const,
          functionName: 'isApprovedForAll',
          args: [owner, operator],
        }).catch(() => null)) as boolean | null

        if (isAll === null) {
          out.push({ label: '当前 NFT 授权状态', value: '无法读取（可能不是 ERC721 合约）', tone: 'neutral' })
        } else if (isAll) {
          out.push({
            label: '当前 NFT 授权状态',
            value: `⚠️ 仍然有效 —— ${operator} 可以转走你所有的 NFT`,
            tone: 'danger',
          })
        } else {
          out.push({ label: '当前 NFT 授权状态', value: '已撤销', tone: 'safe' })
        }
        break
      }

      /* ---------- transfer：查当前余额 ---------- */
      case 'transfer':
      case 'transferFrom': {
        const balance = (await client.readContract({
          address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner],
        })) as bigint
        const dec = parsed.token?.decimals ?? 18
        out.push({
          label: '发送方当前余额',
          value: `${formatUnits(balance, dec)} ${parsed.token?.symbol ?? ''}`,
          tone: 'neutral',
        })
        break
      }

      default:
        break
    }
  } catch (e: any) {
    out.push({
      label: '模拟失败',
      value: e.shortMessage || e.message || '读取链上状态出错',
      tone: 'neutral',
    })
  }

  return out
}
