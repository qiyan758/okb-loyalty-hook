# Twitter / X drafts — OKB-Boost Loyalty Hook

Project handle TBD. Tag `@XLayerOfficial @Uniswap @flapdotsh` on every post per hackathon rules.

## Tweet 1 — launch

> Shipping for **Hook the Future** on X Layer:
>
> **OKB-Boost** — a Uniswap V4 hook that turns trading volume into a soulbound score and rebates LP fees by tier. The more you trade, the cheaper your next swap.
>
> Live on chain 196. Hook fires on every swap. Soulbound score, no farming.
>
> Hook contract: 0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0
>
> @XLayerOfficial @Uniswap @flapdotsh
>
> 🧵👇

## Tweet 2 — how it works

> Two callbacks do the work:
>
> `beforeSwap` reads your tier from the SBT, returns the matching LP fee with the OVERRIDE flag — V4 honors it for *this* swap only.
>
> `afterSwap` credits your address with the trade size. Volume crosses a threshold → next swap pays a lower fee. No governance, no manual tier change.

## Tweet 3 — soulbound

> Why soulbound?
>
> If loyalty is a transferable token, it's just yield farming with extra steps. Whales rent it from the floor.
>
> If it's stuck to the address that earned it, the discount is *for the trader*, and the LP curve gains a new dimension: trader identity.

## Tweet 4 — tx receipt

> The on-chain proof, end-to-end:
>
> Hook deployed at 0xd60374Fd3Cfd96459bFF9DB5b0D67555Ece6A0C0
> Pool initialized with `fee = DYNAMIC_FEE_FLAG`, hook bound.
> Demo swap: oklink.com/xlayer/tx/0x46268946b425a5dd6d08444276c1c92e34ba9861cee1518689a2bc8c5c184ab8
> Post-swap `volumeOf(deployer) = 10 ether` exactly as recorded by the hook.

## Tweet 5 — tease for v2

> What's next:
>
> - Hook stack composes: a buyback hook, a sandwich-shield, a TWAMM all reading the same loyalty score.
> - Per-pool premium tiers (charity-pool dust → Gold tier instantly).
> - OKB stake → tier multiplier instead of just volume.
>
> If you're building on V4 and want to plug in, my DMs are open.

## Tweet 6 — repo + thanks

> Code: github.com/<owner>/<repo> · all contracts verified, 6/6 tests, deploy script reproducible.
>
> Big thanks to @XLayerOfficial for the cheap-and-fast L2, @Uniswap for V4, @flapdotsh for the hook ecosystem push.
>
> Hook the Future ✊

## Operating notes

- Post Tweet 1 and Tweet 6 with screenshots: Tweet 1 → tier card UI, Tweet 6 → all-green test output.
- Pin Tweet 1.
- Reply chain: 2 → 3 → 4 → 5 under Tweet 1.
- Keep posting through the judging window. Suggested cadence: launch tweet day-of, technical thread next day, "what we'd do next" the day before judging closes.
