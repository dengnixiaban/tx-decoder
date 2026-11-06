import { useState } from 'react'
import { formatEther } from 'viem'
import { parseTransaction } from './core/parse'
import { overallLevel, labelAddress } from './core/risk'
import { CHAINS, explorerTxUrl, getChain } from './core/chains'
import type { SimulationItem } from './core/simulate'
import type { ParsedTx, RiskLevel } from './types'
import './App.css'

/* 演示用的真实交易（都是主网上实际发生的） */
const EXAMPLES = [
  { label: '🔴 无限授权 USDT', hash: '0xdb5b04f013bf380610fcf5c035e2cc0d8fbf15de18ca37fd09872bf8570ca5de' },
  { label: '⚪ 普通转账', hash: '0x544d6b012587bf1eb2386327ee9774b5317e6ae0449ffc82dec383002d6050d5' },
  { label: '🔴 授权全部 NFT', hash: '0x64c11645c6023f88d2419c901bcc94e402916cc137bb6da2a6d60b7e7eb7232e' },
]

const LEVEL_STYLE: Record<RiskLevel, { color: string; text: string; icon: string }> = {
  high:   { color: '#f85149', text: '高危', icon: '🔴' },
  medium: { color: '#d29922', text: '中危', icon: '🟡' },
  low:    { color: '#58a6ff', text: '低危', icon: '🔵' },
  none:   { color: '#3fb950', text: '未发现风险', icon: '⚪' },
}

const TONE_COLOR: Record<SimulationItem['tone'], string> = {
  danger: '#f85149', warn: '#d29922', safe: '#3fb950', neutral: '#8b949e',
}

type Result = ParsedTx & { simulation?: SimulationItem[] }

export default function App() {
  const [hash, setHash] = useState('')
  const [chainId, setChainId] = useState(1)
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleParse(h?: string, cid?: number) {
    const target = (h ?? hash).trim()
    const chain = cid ?? chainId
    if (!target) return
    setLoading(true); setError(null); setResult(null)
    try {
      setResult(await parseTransaction(target, chain))
      setHash(target); setChainId(chain)
    } catch (e: any) {
      setError(e.shortMessage || e.message || '解析失败')
    } finally {
      setLoading(false)
    }
  }

  const level = result ? overallLevel(result.risks) : null
  const style = level ? LEVEL_STYLE[level] : null
  const chainConf = result ? getChain(result.chainId) : undefined

  return (
    <div className="app">
      <header>
        <h1>🔍 交易安全解析器</h1>
        <p className="sub">输入交易哈希，看懂你（或别人）到底在签什么</p>
      </header>

      {/* 链选择 */}
      <div className="chain-row">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            className={`chip ${chainId === c.id ? 'active' : ''}`}
            onClick={() => setChainId(c.id)}
          >
            {c.shortName}
          </button>
        ))}
      </div>

      {/* 输入 */}
      <div className="input-row">
        <input
          placeholder="0x...（66 位交易哈希）"
          value={hash}
          onChange={(e) => setHash(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleParse()}
        />
        <button onClick={() => handleParse()} disabled={loading || !hash.trim()}>
          {loading ? '解析中…' : '解析'}
        </button>
      </div>

      <div className="examples">
        <span className="examples-label">真实交易示例（主网）：</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.hash} className="chip" onClick={() => handleParse(ex.hash, 1)}>
            {ex.label}
          </button>
        ))}
      </div>

      {error && <div className="error">⚠️ {error}</div>}

      {result && style && (
        <>
          <div className="banner" style={{ borderColor: style.color }}>
            <div className="banner-level" style={{ color: style.color }}>
              {style.icon} {style.text}
            </div>
            <div className="banner-text">
              {result.decoded?.humanReadable ?? '这是一笔普通 ETH 转账'}
            </div>
          </div>

          {/* 链上状态回查 */}
          {result.simulation && result.simulation.length > 0 && (
            <section>
              <h2>链上状态回查（当前）</h2>
              <div className="sim-list">
                {result.simulation.map((s, i) => (
                  <div key={i} className="sim-item" style={{ borderLeftColor: TONE_COLOR[s.tone] }}>
                    <div className="sim-label">{s.label}</div>
                    <div className="sim-value" style={{ color: TONE_COLOR[s.tone] }}>{s.value}</div>
                  </div>
                ))}
              </div>
              <p className="note">
                注：这是最新的链上状态，不是交易发生时的状态
                （历史状态需要 archive 节点，公共 RPC 不支持）
              </p>
            </section>
          )}

          <section>
            <h2>交易详情</h2>
            <table className="kv">
              <tbody>
                <tr><td>交易哈希</td><td><code>{result.hash}</code></td></tr>
                <tr>
                  <td>网络</td>
                  <td>
                    {chainConf?.name}
                    {chainConf && (
                      <a className="link" href={explorerTxUrl(result.chainId, result.hash)} target="_blank" rel="noreferrer">
                        在浏览器打开 ↗
                      </a>
                    )}
                  </td>
                </tr>
                <tr>
                  <td>状态</td>
                  <td>{result.status === 'success'
                    ? <span className="ok">✅ 成功</span>
                    : <span className="bad">❌ 失败（reverted，gas 已扣）</span>}</td>
                </tr>
                <tr><td>区块</td><td>{result.blockNumber.toString()}</td></tr>
                <tr><td>发送方</td><td><code>{result.from}</code></td></tr>
                <tr>
                  <td>目标地址</td>
                  <td>
                    <code>{result.to ?? '（合约创建）'}</code>
                    {result.to && labelAddress(result.to) && (
                      <span className="tag">{labelAddress(result.to)}</span>
                    )}
                  </td>
                </tr>
                <tr><td>ETH 金额</td><td>{formatEther(result.value)} ETH</td></tr>
                <tr><td>Gas 消耗</td><td>{result.gasUsed.toString()}</td></tr>
                {result.token && (
                  <tr><td>代币</td><td>{result.token.symbol}（decimals {result.token.decimals}）</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {result.decoded && (
            <section>
              <h2>方法识别</h2>
              <table className="kv">
                <tbody>
                  <tr><td>函数选择器</td><td><code>{result.decoded.selector}</code></td></tr>
                  <tr><td>方法名</td><td>{result.decoded.method ?? '未识别'}</td></tr>
                  <tr><td>识别方式</td><td>{result.decoded.source}</td></tr>
                  <tr><td>可信度</td><td>
                    {result.decoded.confidence === 'high' ? '高'
                      : result.decoded.confidence === 'medium' ? '中（参数未完全解码）' : '低'}
                  </td></tr>
                  {result.decoded.args && (
                    <tr><td>参数</td><td>
                      <code className="args">
                        {JSON.stringify(result.decoded.args, (_, v) =>
                          typeof v === 'bigint' ? v.toString() : v)}
                      </code>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h2>风险明细</h2>
            {result.risks.length === 0 ? (
              <p className="ok">✅ 未发现明显风险</p>
            ) : (
              <ul className="risks">
                {result.risks.map((r, i) => {
                  const s = LEVEL_STYLE[r.level]
                  return (
                    <li key={i} style={{ borderLeftColor: s.color }}>
                      <strong style={{ color: s.color }}>{s.icon} {r.reason}</strong>
                      {r.detail && <div className="risk-detail">{r.detail}</div>}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <footer>
        <p>数据来自公共 RPC · 未知方法通过 4byte.directory 反查 · 本工具只做解析，不连接你的钱包</p>
      </footer>
    </div>
  )
}
