/**
 * 主流程：给一个 txHash + chainId，解析出人能看懂的结果
 */
import {
  createPublicClient,
  http,
  decodeFunctionData,
  formatEther,
  type PublicClient,
} from 'viem'
import { mainnet } from 'viem/chains'
import { erc20Abi } from './abis'
import { getSelector, lookupSelector } from './selectors'
import { humanize, humanizePlainTransfer } from './humanize'
import { assessRisk } from './risk'
import { simulate, type SimulationItem } from './simulate'
import { getChain } from './chains'
import type { ParsedTx, TokenMeta } from '../types'

/* ---------- 客户端缓存：每条链一个，避免重复建连接 ---------- */
const clients = new Map<number, PublicClient>()

export function getClient(chainId: number = mainnet.id): PublicClient {
  const cached = clients.get(chainId)
  if (cached) return cached

  const conf = getChain(chainId)
  if (!conf) throw new Error(`不支持的链：chainId ${chainId}`)

  const c = createPublicClient({
    chain: conf.viemChain,
    transport: http(conf.rpc),
  }) as PublicClient

  clients.set(chainId, c)
  return c
}

/* 保留旧的导出，兼容已有代码 */
export const client = getClient(mainnet.id)

/** 读取代币元信息 */
async function fetchTokenMeta(
  client: PublicClient,
  address: `0x${string}`,
): Promise<TokenMeta | null> {
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }),
    ])
    return { symbol: String(symbol), decimals: Number(decimals) }
  } catch {
    return null
  }
}

/**
 * 查 4byte.directory 反查未知选择器
 *
 * ⚠️ 为什么不直接请求 4byte.directory：
 *    它没有返回 Access-Control-Allow-Origin 头，
 *    浏览器直接 fetch 会被 CORS 拦截（命令行不受影响）。
 *
 * 所以走同源代理：
 *   开发环境 → vite.config.ts 里配了 proxy
 *   生产环境 → nginx 里配了 /4byte/ 反代
 */
const FOURBYTE_BASE = import.meta.env.VITE_FOURBYTE_BASE || '/4byte'

async function lookup4byte(selector: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${FOURBYTE_BASE}/signatures/?hex_signature=${selector}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const json = await res.json()
    return json?.results?.[0]?.text_signature ?? null
  } catch {
    return null
  }
}

export interface ParseOptions {
  /** 是否做链上状态回查（默认开启） */
  simulate?: boolean
}

export async function parseTransaction(
  hash: string,
  chainId: number = mainnet.id,
  opts: ParseOptions = {},
): Promise<ParsedTx & { simulation?: SimulationItem[] }> {
  const h = hash.trim() as `0x${string}`
  if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
    throw new Error('交易哈希格式不对，应该是 0x 开头的 66 位十六进制')
  }

  const client = getClient(chainId)

  /* ---------- 拉数据 ---------- */
  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash: h }),
    client.getTransactionReceipt({ hash: h }),
  ])

  const selector = getSelector(tx.input)
  const info = lookupSelector(selector)
  const status: 'success' | 'reverted' = receipt.status === 'success' ? 'success' : 'reverted'

  /* ---------- 解码 ---------- */
  let args: readonly unknown[] | null = null
  let method: string | null = null
  let confidence: 'high' | 'medium' | 'low' = 'low'
  let source = '未知'
  let humanReadable = ''
  let token: TokenMeta | null = null

  if (selector === '0x') {
    humanReadable = humanizePlainTransfer(tx.to ?? '', tx.value)
    source = '纯转账'
    confidence = 'high'
  } else if (info) {
    method = info.method
    source = '内置选择器表'
    confidence = 'high'

    if (info.category === 'erc20' || info.category === 'erc721') {
      token = await fetchTokenMeta(client, tx.to as `0x${string}`)
    }

    if (info.abi.length > 0) {
      try {
        const decoded = decodeFunctionData({ abi: info.abi, data: tx.input })
        args = decoded.args as readonly unknown[]
      } catch {
        confidence = 'medium'
      }
    }

    if (args) {
      const r = humanize(method, args, token, tx.value)
      humanReadable = r.text
      confidence = r.confidence
    } else {
      humanReadable = `调用 ${info.method}（参数无法解码）`
    }
  } else {
    const sig = await lookup4byte(selector)
    if (sig) {
      method = sig.split('(')[0]
      source = '4byte.directory'
      confidence = 'medium'
      humanReadable = `调用未知合约的方法 ${sig}（参数未解码）`
    } else {
      source = '无法识别'
      humanReadable = `无法识别这笔交易在做什么（选择器 ${selector}）`
    }
  }

  /* ---------- 风险 ---------- */
  const risks = assessRisk({
    selector, info, args,
    to: tx.to,
    value: tx.value,
    status,
    txValue: tx.value,
  })

  const parsed: ParsedTx = {
    hash: h,
    chainId,
    status,
    blockNumber: receipt.blockNumber,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    input: tx.input,
    gasUsed: receipt.gasUsed,
    decoded: selector === '0x' && tx.value === 0n
      ? null
      : { selector, method, confidence, source, args, humanReadable },
    risks,
    token,
  }

  /* ---------- 链上状态回查 ---------- */
  let simulation: SimulationItem[] | undefined
  if (opts.simulate !== false) {
    simulation = await simulate(parsed, client)
  }

  return { ...parsed, simulation }
}

export { formatEther }
