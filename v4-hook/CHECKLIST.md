# Submission checklist — OKB-Boost Loyalty Hook

Use this as a pre-flight before hitting the Google Form. Boxes are intentionally checked off where the work is actually done; the rest are *yours*.

## Code & on-chain (done)

- [x] Hook compiles, tests pass: `cd v4-hook && npx hardhat test` → 6/6
- [x] Hook deployed to X Layer mainnet: `0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0`
- [x] V4 pool initialized with hook + dynamic fee
- [x] Liquidity seeded
- [x] **Real demo swap on chain** triggering the hook: `0x46268946b425a5dd6d08444276c1c92e34ba9861cee1518689a2bc8c5c184ab8`
- [x] Soulbound score (`LoyaltySBT`) deployed and locked to the hook
- [x] All addresses in `v4-hook/deployments/xlayer.json`

## Frontend

- [x] Tier card + fee badge + swap UI in `web/pages/index.tsx`
- [x] Reads `LoyaltySBT.tierOf` / `feeOf` / `volumeOf` live
- [x] `web/.env.local` populated with mainnet addresses
- [ ] **You** decide on hosting: Vercel free tier works (`cd web && vercel`), or just keep it local for the demo video

## Writeup

- [x] [`SUBMISSION.md`](SUBMISSION.md) — main project writeup
- [x] [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) — 90-second video script
- [x] [`TWEET_DRAFTS.md`](TWEET_DRAFTS.md) — launch tweet + thread

## Tasks left for you (the human)

- [ ] **Twitter (X) account.** Hackathon rules require an *independent* account. Create one, set bio to "Building OKB-Boost Loyalty Hook on @XLayerOfficial · Hook the Future · @Uniswap × @flapdotsh".
- [ ] **Post Tweet 1** with `@XLayerOfficial @Uniswap @flapdotsh` tagged. Pin it.
- [ ] **Post the thread** under Tweet 1 (drafts in `TWEET_DRAFTS.md`). Stagger by 30+ minutes; the rules ask for sustained activity, not a flood.
- [ ] **Demo video.** Record 90–120 s following [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md). Upload to YouTube unlisted or Twitter video.
- [ ] **Push code to a public GitHub repo.** Suggested name `okb-loyalty-hook`. Update README links if the repo URL differs from `xlayer-dex/`.
- [ ] **Fill the Google Form** (linked from the hackathon page) with:
  - Project name: OKB-Boost Loyalty Hook
  - One-liner from `SUBMISSION.md`
  - GitHub URL
  - Demo video URL
  - Twitter handle
  - X Layer mainnet contract addresses (all from `deployments/xlayer.json`)
  - Demo swap tx hash for verification

## Eleventh-hour tips

- Submit on the form **before** posting the final thread tweet — gives you a buffer if something glitches.
- The mock tokens are mintable by anyone (`MockERC20.mint`); add that to the README so judges can self-fund and try the hook themselves.
- If you have time for one more polish, point a real fungible token pair at the same hook to show it's not married to the mock tokens.
