# OKB Loyalty Hook

**一个让交易量变成软绑定费率折扣的 Uniswap V4 Hook，部署在 X Layer 主网。**

钱包交易得越多，下一笔 swap 的 LP 费率越低 —— 全自动、链上结算、无需任何链下账本。每个钱包都有自己的忠诚度曲线，分数不可转移、不可"刷"。

> English: [README.md](README.md)

## 工作原理

两个回调把整套机制跑通：

- **`beforeSwap`** 从 soulbound 分数中读取你当前的等级，按等级返回 LP 费率（带 override flag）。V4 只对这一笔 swap 应用该费率。
- **`afterSwap`** 把这笔的成交量累加到你地址的分数上。当累计量跨过阈值，你的钱包**下一笔 swap** 自动按更高等级的费率支付。

| 等级       | 累计成交量      | LP 费率 |
| ---------- | --------------:| -------:|
| Newcomer   | 0              | 0.30 %  |
| Bronze     | ≥ 100          | 0.25 %  |
| Silver     | ≥ 1 000        | 0.15 %  |
| Gold       | ≥ 10 000       | 0.05 %  |

分数存放在 `LoyaltySBT` 合约里 —— 不可转移，写入权限锁定在 Hook 上。
任何挂载该 Hook 的池子都共享同一份分数：A 池的成交量帮你在 B 池升级。

## X Layer 主网部署（chain 196）

| 合约                       | 地址 |
| -------------------------- | ---- |
| OKBLoyaltyHook             | [`0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0`](https://www.oklink.com/xlayer/address/0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0) |
| LoyaltySBT                 | [`0xb86FB39D80137AC8674d51a27ed665a0A809deb2`](https://www.oklink.com/xlayer/address/0xb86FB39D80137AC8674d51a27ed665a0A809deb2) |
| LoyaltyRouter              | [`0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27`](https://www.oklink.com/xlayer/address/0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27) |
| Token0（ALPHA，可公开 mint）| [`0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA`](https://www.oklink.com/xlayer/address/0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA) |
| Token1（BETA，可公开 mint） | [`0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE`](https://www.oklink.com/xlayer/address/0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE) |
| Uniswap V4 PoolManager     | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |

池子参数：dynamic fee（`0x800000`），tickSpacing 60，初始化时绑定 Hook。

## 项目结构

```
v4-hook/
├── contracts/
│   ├── OKBLoyaltyHook.sol     继承 BaseHook，实现 beforeSwap / afterSwap
│   ├── LoyaltySBT.sol         Soulbound 成交量 + 等级追踪
│   ├── LoyaltyRouter.sol      unlock + swap 辅助器，把交易者地址编进 hookData
│   ├── Create2Deployer.sol    CREATE2 部署器，用于 hook 地址挖掘
│   └── MockERC20.sol          公开可 mint 的演示代币
├── scripts/
│   ├── deploy.js              一键部署 + 首笔 swap
│   └── hook-miner.js          HookMiner 的 JS 移植，从权限位反推 salt
├── test/
│   └── loyalty-hook.test.js   6 个测试，全部通过
├── deployments/xlayer.json    主网地址列表
└── video/                     Remotion 渲染的演示视频
web/
├── pages/index.tsx            等级阶梯、费率对比、swap UI、实时活动流
└── lib/{abi,wagmi,chains}.ts
```

Hook 地址 `0xd60374Fd…E6A0C0` 末尾的 14 位是 V4 用来编码 `BEFORE_INITIALIZE | BEFORE_SWAP | AFTER_SWAP` 这三个权限的特定比特位。部署脚本通过 HookMiner 的 JS 移植版挖出对应的 salt。

SBT 采用两阶段部署：先以 `hook = address(0)` 部署 SBT；CREATE2 部署 Hook 到挖出来的地址；SBT 部署者调用一次 `setHook(...)`，SBT 永久锁定到 Hook。

## 本地运行

### 智能合约

```bash
cd v4-hook
npm install
npx hardhat test                              # 6 通过
echo "PRIVATE_KEY=0x…" > .env
npx hardhat run scripts/deploy.js --network xlayer
```

`scripts/deploy.js` 使用 X Layer 上预部署的 Uniswap V4 PoolManager，部署 SBT + Hook + Router + 两个可 mint 的代币，初始化动态费率池，注入流动性，并跑一笔 demo swap。所有产出地址写进 `deployments/xlayer.json`。

### 前端

```bash
cd web
cp .env.local.example .env.local              # 把 deployments/xlayer.json 的地址填进去
npm install
npm run dev                                    # 打开 http://localhost:3000
```

主网上的 `MockERC20.mint(address, amount)` 是公开方法，任何人都可以 mint 测试代币上手试用。

### 演示视频

`v4-hook/video/out/okb-loyalty-hook.mp4` 是已渲染好的 43 秒讲解视频（1080p，3.6 MB）。重新构建：

```bash
cd v4-hook/video
npm install
node fetch-chain-data.js                      # 拉取真实链上交易数据
npm run render                                 # → out/okb-loyalty-hook.mp4
# 或：npm run studio                            # 浏览器实时预览
```

视频里的链上数据是真的：构建时从 X Layer RPC 拉 `chain-data.json`，画面里的合约地址、交易哈希都和链上一致。

## 安全设计

- **身份穿透。** PoolManager 看到的 `msg.sender` 是 Router，永远不是真实交易者。交易者地址通过 `hookData`（`abi.encode(user)`）从 `LoyaltyRouter.unlockCallback` 一路传到 Hook。如果一笔 swap 没带 hookData，Hook 给最高费率 —— 匿名流量拿不到折扣。
- **费率覆盖防误用。** Hook 拒绝任何没用 `LPFeeLibrary.DYNAMIC_FEE_FLAG` 初始化的池子。这样 Hook 不会被静悄悄挂在静态费率池上（那种池子里 override 会被忽略）。
- **Soulbound 语义。** SBT 没有任何 transfer 接口，也没有 `volumeOf` 的 setter。唯一的写入函数是 `accrue`，由 `msg.sender` 校验只接受 Hook 调用。Hook 通过 `setHook` 一次性绑定，绑定后 SBT 永久锁定。

## 协议

MIT。
