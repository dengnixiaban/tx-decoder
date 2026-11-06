# 🔍 交易安全解析器 Transaction Decoder

![CI](https://github.com/dengnixiaban/tx-decoder/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![viem](https://img.shields.io/badge/viem-2.x-6b7280)
![chains](https://img.shields.io/badge/chains-6-3fb950)
![demo](https://img.shields.io/badge/demo-live-brightgreen)


把看不懂的以太坊交易，翻译成人能读懂的一句话，并给出风险评级。

> Web3 最大的安全问题不是合约被攻破，而是**用户盲签** ——
> 钱包只给你看一串十六进制，你根本不知道自己在签什么。
> 这个工具就是解决这个问题的。

## 效果

输入一笔真实交易，输出：

```
🔴 风险等级: HIGH

📖 一句话解读：
   将你的【全部 USDT】无限期授权给 0x0220…9aB7（无限授权）

🔎 链上当前状态：
   ⚠️ 当前授权额度: ⚠️ 无限 —— 0x0220...9aB7 仍可转走你全部的 USDT

⚠️ 风险明细：
   🔴 [high] 无限授权
      该地址可以随时转走你全部的代币，不需要你再次确认
```

## 功能

```
✅ 支持 6 条链：Ethereum / Base / Arbitrum / Optimism / Sepolia / BNB Chain
✅ 输入交易哈希 → 自动拉取并解码 calldata
✅ 内置 8 个常见方法的选择器表（transfer / approve / setApprovalForAll / ...）
✅ 未知方法自动查 4byte.directory 反查函数签名
✅ 读取代币 symbol / decimals，金额自动格式化
✅ 三级风险判定（高 / 中 / 低）
✅ 链上状态回查（这个授权现在还在不在）
✅ 已知合约标签（USDT / USDC / DAI / WETH）
✅ 命令行版本，可批量解析
```

## 🌐 在线演示

**http://149.28.133.245:8090/**

点页面上的三个示例按钮，可以直接看真实主网交易的解析结果。

## 快速开始

```bash
npm install
npm run dev          # 打开 http://localhost:5173

# 命令行版
npm run parse -- 0xdb5b04f013bf380610fcf5c035e2cc0d8fbf15de18ca37fd09872bf8570ca5de
npm run parse -- <txHash> 8453     # 指定链（8453 = Base）
npm run parse                       # 自动解析最新区块的交易
```

## 项目结构

```
src/
├── App.tsx              界面
├── types.ts             类型定义
└── core/
    ├── chains.ts        6 条链的配置（id / RPC / 浏览器）
    ├── selectors.ts     ★ 函数选择器对照表
    ├── abis.ts          ERC20 / ERC721 / WETH 的 ABI 片段
    ├── humanize.ts      ★ 参数 → 人话
    ├── risk.ts          ★ 风险判定
    ├── simulate.ts      ★ 链上状态回查
    └── parse.ts         主流程编排
scripts/
└── cli.ts              命令行版本
```

## 核心设计

### 1. 函数选择器（不看合约地址，只看 calldata）

```ts
// calldata 的前 10 个字符就是函数选择器
// 0x095ea7b3 = approve(address,uint256)
// 0xa9059cbb = transfer(address,uint256)
```

好处：**不需要知道目标合约是什么**，只看 calldata 就能识别方法。
选择器表里的哈希全部用 viem 的 `toFunctionSelector()` 实算验证过。

### 2. 三层识别策略

```
① 内置选择器表      → 覆盖 80% 常见操作，可信度：高
② 4byte.directory  → 反查未知签名，可信度：中
③ 都查不到          → 只展示原始参数 + 标红，可信度：低
```

### 3. 人话翻译（项目的核心价值）

```ts
// ❌ 差
approve(0x0220..., 115792089237316195423570985008687907853269984665640564039457584007913129639935)

// ✅ 好
将你的【全部 USDT】无限期授权给 0x0220…9aB7（无限授权）
```

### 4. 链上状态回查

**说清楚一个限制**：我们无法在交易发生时的历史状态上重放执行
（那需要 archive 节点，公共 RPC 一般只保留最近 128 个区块的状态）。

所以做的是查**这笔交易造成的当前结果**：

```
approve 交易        → 这个授权现在还在不在、额度多少
setApprovalForAll   → 这个 NFT 授权是否仍然有效
transfer            → 发送方当前余额
```

**这恰恰是用户最想知道的：「我现在还有没有这个风险」。**

## 踩过的坑（面试可以讲）

1. **有 calldata 但没识别出来的交易，不能当成纯 ETH 转账**
   —— 最初的判断条件只看 `value > 0`，会把未知合约调用误标为"安全"。

2. **publicnode 的 Arbitrum / Optimism 节点不支持 `eth_getTransactionReceipt`**
   —— 返回 "Invalid parameters"，`getTransaction` 却正常。
   换用官方 RPC（`arb1.arbitrum.io` / `mainnet.optimism.io`）后解决。

3. **ERC20 的 decimals 不一定是 18**
   —— USDC 是 6，WBTC 是 8。硬编码 18 会让金额差 12 个数量级。

4. **`decodeFunctionData` 遇到 ABI 不匹配会抛异常**
   —— 必须 try/catch，降级为"只显示选择器"，而不是整个解析失败。

## 待做

```
⬜ 地址标签接 Etherscan / 自建数据库（现在只有 5 个硬编码）
⬜ 交易模拟升级（Tenderly / Alchemy simulation API，能看到余额变化）
⬜ 浏览器扩展形式（在钱包弹窗前拦截）
⬜ 批量扫描：一个地址的最近 N 笔交易风险汇总
⬜ 分享功能：生成风险报告图片
```

## 部署

```bash
HOST=root@your-server ./deploy.sh   # 构建 + 上传 + 验证
```

生产环境是 nginx 静态托管 + `/4byte/` 反向代理：

```
/var/www/tx-decoder           静态文件
/etc/nginx/sites-available/tx-decoder   站点配置
:8090   →  /                 SPA
        →  /4byte/          反代到 4byte.directory（绕开 CORS）
```

**为什么要反代 4byte.directory**：它没有返回 `Access-Control-Allow-Origin`，
浏览器直接 fetch 会被 CORS 拦，命令行却正常 —— 这是只有部署后才会暴露的问题。

## 技术栈

```
React 19 + TypeScript + Vite
viem（链交互，不用 ethers/web3.js）
```

## 免责声明

本工具只做只读解析，**不连接任何钱包、不发起任何交易**。
解析结果仅供参考，不能替代你自己的判断。
