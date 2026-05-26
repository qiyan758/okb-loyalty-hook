# XLayer DEX Hackathon Workspace

Hook the Future submission lives in [`v4-hook/`](v4-hook/). The original V2 reference DEX is in `contracts/` and `web/`.

## Hackathon submission

→ [`v4-hook/SUBMISSION.md`](v4-hook/SUBMISSION.md) — the actual writeup judges should read.

→ [`v4-hook/DEMO_SCRIPT.md`](v4-hook/DEMO_SCRIPT.md) — 90-second video script.

→ [`v4-hook/TWEET_DRAFTS.md`](v4-hook/TWEET_DRAFTS.md) — launch + thread, ready to post.

→ [`v4-hook/deployments/xlayer.json`](v4-hook/deployments/xlayer.json) — all mainnet addresses + tx hashes.

## Layout

```
xlayer-dex/
├── v4-hook/      ← Hackathon entry: OKBLoyaltyHook (Uniswap V4)
├── web/          ← Next.js + wagmi + RainbowKit frontend (talks to v4-hook)
└── contracts/    ← V2 reference DEX (predates the hackathon, not part of submission)
```

## Quickstart

```bash
# Run the V4 hook tests
cd v4-hook && npm install && npx hardhat test

# Deploy to X Layer mainnet
echo "PRIVATE_KEY=0x…" > .env
npx hardhat run scripts/deploy.js --network xlayer

# Run the frontend
cd ../web
cp .env.local.example .env.local  # paste addresses
npm install && npm run dev
```
