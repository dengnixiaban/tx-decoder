/**
 * 命令行版解析器
 *
 * 用法：
 *   npm run parse -- <txHash> [chainId]
 *   npm run parse              # 自动解析最新区块里的几笔不同类型交易
 */
import { parseTransaction, getClient } from '../src/core/parse'
import { overallLevel } from '../src/core/risk'
import { getChain } from '../src/core/chains'
import { formatEther } from 'viem'

const ICON = { high: '🔴', medium: '🟡', low: '🔵', none: '⚪' } as const
const TONE_ICON = { danger: '⚠️', warn: '🟡', safe: '✅', neutral: 'ℹ️' } as const

async function show(hash: string, chainId = 1) {
  try {
    const r = await parseTransaction(hash, chainId)
    const lvl = overallLevel(r.risks)
    const conf = getChain(chainId)

    console.log('\n' + '═'.repeat(74))
    console.log(`${ICON[lvl]} 风险等级: ${lvl.toUpperCase()}   网络: ${conf?.name ?? chainId}`)
    console.log('═'.repeat(74))
    console.log(`  交易:     ${r.hash}`)
    console.log(`  区块:     ${r.blockNumber}`)
    console.log(`  状态:     ${r.status === 'success' ? '✅ 成功' : '❌ 失败(reverted)'}`)
    console.log(`  从:       ${r.from}`)
    console.log(`  到:       ${r.to ?? '（合约创建）'}`)
    console.log(`  ETH:      ${formatEther(r.value)}`)
    console.log(`  gas:      ${r.gasUsed}`)
    console.log(`  选择器:   ${r.decoded?.selector ?? '0x（纯转账）'}`)
    console.log(`  识别方式: ${r.decoded?.source ?? '-'}`)

    if (r.decoded) {
      console.log(`\n  📖 一句话解读：`)
      console.log(`     ${r.decoded.humanReadable}`)
    }

    if (r.simulation?.length) {
      console.log(`\n  🔎 链上当前状态：`)
      for (const s of r.simulation) {
        console.log(`     ${TONE_ICON[s.tone]} ${s.label}: ${s.value}`)
      }
    }

    if (r.risks.length) {
      console.log(`\n  ⚠️  风险明细：`)
      for (const risk of r.risks) {
        console.log(`     ${ICON[risk.level]} [${risk.level}] ${risk.reason}`)
        if (risk.detail) console.log(`        ${risk.detail}`)
      }
    } else {
      console.log(`\n  ✅ 未发现明显风险`)
    }

    if (conf) console.log(`\n  🔗 ${conf.explorer}/tx/${hash}`)
  } catch (e: any) {
    console.log(`\n  ❌ 解析失败: ${e.shortMessage || e.message}`)
  }
}

const arg = process.argv[2]
const cid = Number(process.argv[3] || 1)

if (!arg || arg === '--latest') {
  console.log('自动从最新区块挑几笔不同类型的交易…\n')
  const client = getClient(cid)
  const block = await client.getBlock({ blockNumber: await client.getBlockNumber() })
  const seen = new Set<string>()
  let count = 0
  for (const h of block.transactions) {
    if (count >= 3) break
    const tx = await client.getTransaction({ hash: h })
    const sel = tx.input === '0x' ? '0x' : tx.input.slice(0, 10)
    if (seen.has(sel)) continue
    seen.add(sel); count++
    await show(h, cid)
  }
} else {
  await show(arg, cid)
}
