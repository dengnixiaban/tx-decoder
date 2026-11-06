export type RiskLevel = 'high' | 'medium' | 'low' | 'none'

export interface RiskItem {
  level: RiskLevel
  reason: string
  detail?: string
}

export interface TokenMeta {
  symbol: string
  decimals: number
  name?: string
}

export interface DecodedCall {
  selector: string              // 0x095ea7b3
  method: string | null         // 'approve'
  confidence: 'high' | 'medium' | 'low'   // 识别置信度
  source: string                // 从哪识别出来的：内置表 / 4byte / 未知
  args: readonly unknown[] | null
  humanReadable: string         // ★ 核心：人话
}

export interface ParsedTx {
  hash: string
  chainId: number
  status: 'success' | 'reverted'
  blockNumber: bigint
  from: `0x${string}`
  to: `0x${string}` | null
  value: bigint
  input: `0x${string}`
  gasUsed: bigint
  decoded: DecodedCall | null
  risks: RiskItem[]
  token: TokenMeta | null       // 如果是代币操作，带上代币信息
}
