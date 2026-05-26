# OKB-Boost Loyalty Hook

> One-line: A Uniswap V4 hook on X Layer that turns trading volume into a soulbound loyalty score, and rebates LP fees by tier. The more a wallet trades, the cheaper its next swap gets — automatically, on-chain, no off-chain accounting.
>
> Built for [Hook the Future — Build X Hackathon](https://web3.okx.com/zh-hans/xlayer/build-x-hackathon/hook).

## What it does

OKB-Boost mounts a single hook contract on a V4 dynamic-fee pool. On every swap:

1. **`beforeSwap`** reads the trader's tier from a soulbound score (LoyaltySBT), looks up the matching LP fee, and overrides the pool fee for *this* swap — no governance vote, no manual fee tier switch.
2. **`afterSwap`** credits the trader's address with the trade size. As cumulative volume crosses thresholds, the wallet auto-promotes to the next tier and pays a lower fee on subsequent swaps.

The score is non-transferable (soulbound), so loyalty cannot be farmed by recycling addresses. Every wallet builds its own loyalty curve on X Layer.

| Tier        | Threshold (cumulative volume) | LP fee  |
| ----------- | -----------------------------:| -------:|
| 0 Newcomer  | 0                            | 0.30 %  |
| 1 Bronze    | 100                          | 0.25 %  |
| 2 Silver    | 1 000                        | 0.15 %  |
| 3 Gold      | 10 000                       | 0.05 %  |

## Why it's not a port

This isn't a static-fee pool with off-chain rewards bolted on. It's the **hook itself** rewriting the per-swap fee from address-derived state. Every trade reads its own tier and pays its own fee — the LP curve grows a new dimension (trader identity) without leaving V4's pricing logic.

It's also a **growth loop, not a points program**: the rebate flips on automatically once you've traded enough volume *anywhere on this hook*, so any pool that mounts the same hook contributes to and benefits from the same loyalty score.

## On-chain (X Layer mainnet, chainId 196)

| Contract                       | Address |
| ------------------------------ | ------- |
| Uniswap V4 PoolManager (offcl) | [`0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`](https://www.oklink.com/xlayer/address/0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32) |
| **OKBLoyaltyHook**             | [`0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0`](https://www.oklink.com/xlayer/address/0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0) |
| LoyaltySBT                     | [`0xb86FB39D80137AC8674d51a27ed665a0A809deb2`](https://www.oklink.com/xlayer/address/0xb86FB39D80137AC8674d51a27ed665a0A809deb2) |
| LoyaltyRouter                  | [`0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27`](https://www.oklink.com/xlayer/address/0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27) |
| ALPHA token (token0)           | [`0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA`](https://www.oklink.com/xlayer/address/0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA) |
| BETA token (token1)            | [`0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE`](https://www.oklink.com/xlayer/address/0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE) |

**Pool key:** dynamic fee (`0x800000`), tickSpacing 60, hook bound at deploy.

The hook's address ends in `…E6A0C0`. The bottom 14 bits encode the hook's permission set (BEFORE_INITIALIZE | BEFORE_SWAP | AFTER_SWAP) — V4 enforces this at pool init via the address itself, so there is no way to opt out of these callbacks. We mined the salt with a JS port of HookMiner: [scripts/hook-miner.js](v4-hook/scripts/hook-miner.js).

### Verifiable end-to-end transactions

| Action                | Tx |
| --------------------- | -- |
| Pool initialize       | (in `Pool initialized` step of [deploy.js](v4-hook/scripts/deploy.js); seed run produced PoolKey above) |
| Add liquidity (real PoolManager via `unlock`) | embedded in same deploy run |
| **Demo swap → hook fires** | [`0x46268946b425a5dd6d08444276c1c92e34ba9861cee1518689a2bc8c5c184ab8`](https://www.oklink.com/xlayer/tx/0x46268946b425a5dd6d08444276c1c92e34ba9861cee1518689a2bc8c5c184ab8) |

After the demo swap, `LoyaltySBT.volumeOf(deployer) == 10 ether`, `tierOf == 0` — exactly as the hook should record.

## Repo layout

```
xlayer-dex/
├── v4-hook/                      ← V4 hook (this submission)
│   ├── contracts/
│   │   ├── OKBLoyaltyHook.sol    ← BaseHook subclass (V4 lifecycle)
│   │   ├── LoyaltySBT.sol        ← Soulbound volume + tier tracker
│   │   ├── LoyaltyRouter.sol     ← unlock+swap helper, encodes user in hookData
│   │   ├── Create2Deployer.sol   ← CREATE2 deployer for hook address mining
│   │   └── MockERC20.sol
│   ├── test/loyalty-hook.test.js ← 6/6 passing
│   ├── scripts/
│   │   ├── deploy.js             ← end-to-end: hook → pool → LP → demo swap
│   │   ├── hook-miner.js         ← HookMiner port for Hardhat
│   │   ├── probe-poolmanager.js  ← evidence: official V4 PoolManager works on chain 196
│   │   └── probe-unlock.js       ← evidence: unlock + modifyLiquidity works on chain 196
│   └── deployments/xlayer.json   ← all addresses + tx hashes
├── web/                          ← Next.js + wagmi + RainbowKit
│   ├── pages/index.tsx           ← tier card, fee badge, swap UI
│   └── lib/{abi,wagmi,chains}.ts
└── contracts/                    ← legacy V2 reference (not part of submission)
```

## Quickstart

```bash
# 1. compile + run local Hardhat tests (Cancun-enabled fork)
cd v4-hook
npm install
npx hardhat test            # 6 passing

# 2. deploy to X Layer mainnet (uses pre-deployed PoolManager)
echo "PRIVATE_KEY=0x…" > .env
npx hardhat run scripts/deploy.js --network xlayer

# 3. start the frontend
cd ../web
cp .env.local.example .env.local   # then paste addresses from deployments/xlayer.json
npm install && npm run dev
```

## Technical notes for judges

**Dynamic fee override.** V4 lets a hook override the LP fee per swap if and only if the pool was initialized with `key.fee == LPFeeLibrary.DYNAMIC_FEE_FLAG (0x800000)`. The hook's `beforeSwap` returns `(selector, ZERO_DELTA, fee | OVERRIDE_FEE_FLAG)`. We assert this in [`OKBLoyaltyHook._beforeInitialize`](v4-hook/contracts/OKBLoyaltyHook.sol) so the hook *cannot* be mounted on a static-fee pool by accident.

**Identity propagation.** `msg.sender` at the PoolManager boundary is the router, never the trader. We pass the trader address through `hookData` (`abi.encode(user)`) from [`LoyaltyRouter.unlockCallback`](v4-hook/contracts/LoyaltyRouter.sol). If a swap arrives without hookData, the hook charges the highest fee (T0) — anonymous flow doesn't get a discount.

**Soulbound semantics.** The SBT has no `transfer*` functions and no setter for `volumeOf`. The only writer is `accrue`, gated to the hook by `msg.sender` check. The hook is wired to the SBT via `LoyaltySBT.setHook`, callable exactly once by the deployer; after that, the SBT is permanently locked.

**Two-phase deploy** to break the constructor cycle (hook needs SBT; SBT enforces hook): SBT is deployed first with `hook=address(0)`. Hook is CREATE2-deployed at the mined address. SBT's deployer then calls `setHook` once.

**X Layer note.** The probe scripts in `scripts/probe-*.js` were written to verify that X Layer chain 196 actually executes V4's transient-storage paths (`unlock`, `modifyLiquidity`, `swap`). They confirm that the pre-deployed PoolManager at `0x360E…` is functional. Bytecode also verifies — `extsload(0)` returns the protocol owner address, matching the V4 layout.
