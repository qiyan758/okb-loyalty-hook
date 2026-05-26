# Demo video script — OKB-Boost Loyalty Hook

Target length: 90–120 seconds. Single take is fine; cuts welcome.

## Beats

**0:00–0:10 — Hook line.**
> "Most loyalty programs are off-chain spreadsheets. This is a Uniswap V4 hook on X Layer that gives every wallet a soulbound trading score and rebates LP fees by tier — automatically, on every swap."

Show the OKLink page for the hook contract `0xd60374Fd…E6A0C0`. Pause on the address; mention "the bottom 14 bits of this address aren't an accident — they encode which V4 callbacks the hook subscribes to."

**0:10–0:30 — The pool.**
> "Here's the pool. Dynamic fee, hook bound at init. Liquidity seeded, ALPHA/BETA pair on X Layer mainnet, chain 196."

Show the dApp at `localhost:3000` (or your hosted URL). Connect wallet. Tier card reads **Newcomer (T0) · 0.30%**.

**0:30–0:60 — The first swap.**
> "Watch the fee. Right now this wallet pays 0.30 percent. I'll swap 50 ALPHA into BETA."

Click swap. Confirm. Show the toast / explorer link. Open the SBT contract on OKLink, refresh — `volumeOf` is now 50, tier still 0.

**0:60–1:30 — Tier promotion.**
> "Threshold for tier 1 is 100. One more swap pushes me over."

Swap 60 ALPHA. After the tx confirms, refresh the dApp.

> "Tier card just flipped. **Bronze, T1, 0.25 percent**. The hook just rewrote the fee for my next swap. No governance vote, no manual fee tier change — pure on-chain logic."

Quickly demonstrate one more swap; the explorer trace shows the LP fee on this swap is 2500 (0.25%) instead of 3000.

**1:30–2:00 — Why it matters.**
> "Three things that make this not just a port:
> 1. The score is soulbound — you can't farm it by recycling addresses.
> 2. Any pool that mounts this hook contributes to and benefits from the same loyalty curve. It's a growth loop, not a points program.
> 3. Every line lives on X Layer, every transaction is on-chain verifiable. Run the demo, watch the hook fire."

Final shot: SUBMISSION.md scrolling past addresses + tx hashes.

End card: "OKB-Boost · Hook the Future · X Layer chain 196"

## Recording tips

- Run `npm run dev` in `web/` and have a wallet pre-funded with ALPHA & BETA.
- For the "Bronze" reveal, pre-stage one wallet at ~95 volume and one swap of 10 — keeps the cut tight.
- OKLink loads a touch slowly; pre-open the relevant tx hash tabs and Cmd-Tab.
- Don't read addresses out loud; show them on screen.
