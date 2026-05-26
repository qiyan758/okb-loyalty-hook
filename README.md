# OKB Loyalty Hook

**A Uniswap V4 hook that turns trading volume into a soulbound fee discount on X Layer.**

The more a wallet trades, the cheaper its next swap gets — automatically, on-chain, no off-chain accounting. Every wallet builds its own loyalty curve. The score can't be transferred or farmed.

> 中文版：[README.zh.md](README.zh.md)

## How it works

Two callbacks do all the work:

- **`beforeSwap`** reads your tier from a soulbound score and returns the matching LP fee with the override flag set. V4 honors it for *this* swap only.
- **`afterSwap`** credits your address with the trade size. As cumulative volume crosses a threshold, your wallet auto-promotes and pays a lower fee on the next swap.

| Tier        | Cumulative volume | LP fee  |
| ----------- | -----------------:| -------:|
| Newcomer    | 0                 | 0.30 %  |
| Bronze      | ≥ 100             | 0.25 %  |
| Silver      | ≥ 1 000           | 0.15 %  |
| Gold        | ≥ 10 000          | 0.05 %  |

The score lives in `LoyaltySBT` — non-transferable, write-locked to the hook.
Any pool that mounts this hook contributes to and benefits from the same score.

## Live on X Layer mainnet (chain 196)

| Contract                | Address |
| ----------------------- | ------- |
| OKBLoyaltyHook          | [`0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0`](https://www.oklink.com/xlayer/address/0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0) |
| LoyaltySBT              | [`0xb86FB39D80137AC8674d51a27ed665a0A809deb2`](https://www.oklink.com/xlayer/address/0xb86FB39D80137AC8674d51a27ed665a0A809deb2) |
| LoyaltyRouter           | [`0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27`](https://www.oklink.com/xlayer/address/0x687E56fa1A11DbbF6dDbd313f695406c5Fab6e27) |
| Token0 (ALPHA, mintable)| [`0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA`](https://www.oklink.com/xlayer/address/0x61A9f3B6d2573Fcf8b2c63F762e6b31a6475a6dA) |
| Token1 (BETA, mintable) | [`0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE`](https://www.oklink.com/xlayer/address/0xC56FE23B26a479deE4448E33DCe812d7AB3d2BEE) |
| Uniswap V4 PoolManager  | `0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32` |

Pool: dynamic-fee (`0x800000`), tickSpacing 60, hook-bound at init.

## Architecture

```
v4-hook/
├── contracts/
│   ├── OKBLoyaltyHook.sol     BaseHook subclass — beforeSwap / afterSwap
│   ├── LoyaltySBT.sol         Soulbound volume + tier tracker
│   ├── LoyaltyRouter.sol      unlock+swap helper, encodes user in hookData
│   ├── Create2Deployer.sol    CREATE2 deployer for hook-address mining
│   └── MockERC20.sol          Public-mint demo token
├── scripts/
│   ├── deploy.js              End-to-end deploy + first swap
│   └── hook-miner.js          HookMiner port — derives salt from permission flags
├── test/
│   └── loyalty-hook.test.js   6 tests, all green
├── deployments/xlayer.json    Mainnet addresses
└── video/                     Remotion-built demo video
web/
├── pages/index.tsx            Tier ladder, fee preview, swap UI, live activity feed
└── lib/{abi,wagmi,chains}.ts
```

The hook's address (`0xd60374Fd…E6A0C0`) ends in 14 specific bits — the V4 permission encoding for `BEFORE_INITIALIZE | BEFORE_SWAP | AFTER_SWAP`. The deploy script mines that salt with a JS port of HookMiner.

The SBT is a two-phase deploy: it's deployed first with `hook = address(0)`; the hook is CREATE2-deployed at the mined address; the SBT's deployer then calls `setHook(...)` once and the SBT is permanently locked.

## Run it

### Smart contracts

```bash
cd v4-hook
npm install
npx hardhat test                              # 6 passing
echo "PRIVATE_KEY=0x…" > .env
npx hardhat run scripts/deploy.js --network xlayer
```

`scripts/deploy.js` uses the pre-deployed Uniswap V4 PoolManager on X Layer, deploys the SBT + hook + router + two mintable tokens, initializes a dynamic-fee pool, seeds liquidity, and runs one demo swap. Outputs go to `deployments/xlayer.json`.

### Frontend

```bash
cd web
cp .env.local.example .env.local              # paste addresses from deployments/xlayer.json
npm install
npm run dev                                    # http://localhost:3000
```

Mainnet `MockERC20.mint(address, amount)` is public, so anyone can mint test tokens and try the hook.

### Demo video

`v4-hook/video/out/okb-loyalty-hook.mp4` is the rendered 43-second walkthrough (1080p, 3.6 MB). To rebuild:

```bash
cd v4-hook/video
npm install
node fetch-chain-data.js                      # pull live tx data
npm run render                                 # → out/okb-loyalty-hook.mp4
# or: npm run studio                            # interactive preview
```

The video embeds real chain data — `chain-data.json` is fetched from the X Layer RPC at build time, so the addresses and transaction hash on screen match what's actually on chain.

## Security notes

- **Identity propagation.** `msg.sender` at the PoolManager boundary is the router, never the trader. The trader address travels through `hookData` (`abi.encode(user)`) from `LoyaltyRouter.unlockCallback`. If a swap arrives without hookData, the hook charges the highest fee — anonymous flow doesn't get a discount.
- **Fee override safety.** The hook rejects any pool initialized without `LPFeeLibrary.DYNAMIC_FEE_FLAG`, so it can't be silently mounted on a static-fee pool where the override would be ignored.
- **Soulbound semantics.** The SBT exposes no transfer surface and no setter for `volumeOf`. The only writer is `accrue`, gated to the hook by `msg.sender`. The hook is wired via `setHook`, callable exactly once by the SBT's deployer.

## License

MIT.
