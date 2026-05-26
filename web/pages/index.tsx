import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
} from "wagmi";
import { erc20Abi, routerAbi, sbtAbi } from "../lib/abi";
import {
  ADDRESSES,
  POOL_KEY,
  MIN_SQRT_PRICE_PLUS_1,
  MAX_SQRT_PRICE_MINUS_1,
} from "../lib/wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000";

const TIER_NAMES = ["Newcomer", "Bronze", "Silver", "Gold"];

function feePct(fee: number) {
  return (fee / 10000).toFixed(2);
}

function shortNum(v: bigint, decimals = 18) {
  const s = formatUnits(v, decimals);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > 2) return `${whole}.${frac.slice(0, 2)}`;
  return s;
}

export default function Home() {
  const { address } = useAccount();
  const configured = ADDRESSES.router !== ZERO && ADDRESSES.hook !== ZERO;

  return (
    <>
      <div className="header">
        <div className="brand">OKB Loyalty Hook</div>
        <ConnectButton />
      </div>
      <div className="container">
        {!configured && (
          <div className="notice">
            Contracts not configured. Deploy via <code>v4-hook/scripts/deploy.js</code> and
            paste addresses into <code>web/.env.local</code>.
          </div>
        )}
        {configured && (
          <>
            <TierPanel account={address} />
            <SwapPanel account={address} />
            <ActivityPanel account={address} />
            <Explainer />
          </>
        )}
      </div>
    </>
  );
}

function TierPanel({ account }: { account?: `0x${string}` }) {
  const reads = useReadContracts({
    contracts: [
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "feeOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "volumeOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "swapsOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [0n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [1n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [2n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierFees", args: [0n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierFees", args: [1n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierFees", args: [2n] },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierFees", args: [3n] },
    ],
    query: { enabled: !!account, refetchInterval: 4000 },
  });

  if (!account) return <div className="panel muted">Connect a wallet to see your tier.</div>;

  const tier = (reads.data?.[0]?.result as number | undefined) ?? 0;
  const fee = (reads.data?.[1]?.result as number | undefined) ?? 3000;
  const volume = (reads.data?.[2]?.result as bigint | undefined) ?? 0n;
  const swaps = (reads.data?.[3]?.result as bigint | undefined) ?? 0n;
  const thresholds = [
    0n,
    (reads.data?.[4]?.result as bigint | undefined) ?? 0n,
    (reads.data?.[5]?.result as bigint | undefined) ?? 0n,
    (reads.data?.[6]?.result as bigint | undefined) ?? 0n,
  ];
  const fees = [
    (reads.data?.[7]?.result as number | undefined) ?? 3000,
    (reads.data?.[8]?.result as number | undefined) ?? 2500,
    (reads.data?.[9]?.result as number | undefined) ?? 1500,
    (reads.data?.[10]?.result as number | undefined) ?? 500,
  ];

  const lower = thresholds[tier];
  const upper = tier < 3 ? thresholds[tier + 1] : volume;
  const span = upper > lower ? upper - lower : 1n;
  const inSpan = volume > lower ? volume - lower : 0n;
  const pct = tier === 3 ? 100 : Math.min(100, Number((inSpan * 1000n) / span) / 10);

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="muted" style={{ fontSize: 12 }}>Your tier</div>
          <div className="brand" style={{ fontSize: 22 }}>{TIER_NAMES[tier]} (T{tier})</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted" style={{ fontSize: 12 }}>Current LP fee</div>
          <div className="brand" style={{ fontSize: 22, color: "var(--green)" }}>{feePct(fee)}%</div>
        </div>
      </div>

      <div className="ladder" style={{ marginTop: 14 }}>
        {TIER_NAMES.map((name, i) => (
          <div
            key={i}
            className={`rung ${i === tier ? "current" : i < tier ? "unlocked" : ""}`}
          >
            <div className="name">{name}</div>
            <div className="fee">{feePct(fees[i])}%</div>
          </div>
        ))}
      </div>

      <div className="bar-wrap">
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="bar-meta">
          <span>{shortNum(volume)} volume</span>
          {tier < 3 ? (
            <span>
              {shortNum(thresholds[tier + 1] - volume)} to {TIER_NAMES[tier + 1]}
            </span>
          ) : (
            <span>Top tier — max discount</span>
          )}
        </div>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>{swaps.toString()} swaps recorded by hook</div>
    </div>
  );
}

function SwapPanel({ account }: { account?: `0x${string}` }) {
  const [direction, setDirection] = useState<0 | 1>(0);
  const tokenIn = direction === 0 ? ADDRESSES.token0 : ADDRESSES.token1;
  const [amount, setAmount] = useState("");

  const reads = useReadContracts({
    contracts: [
      { address: tokenIn, abi: erc20Abi, functionName: "decimals" },
      { address: tokenIn, abi: erc20Abi, functionName: "symbol" },
      { address: ADDRESSES.token0, abi: erc20Abi, functionName: "symbol" },
      { address: ADDRESSES.token1, abi: erc20Abi, functionName: "symbol" },
      { address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: account ? [account] : undefined },
      { address: tokenIn, abi: erc20Abi, functionName: "allowance", args: account ? [account, ADDRESSES.router] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "feeOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierFees", args: [0n] }, // baseline T0 fee
    ],
    query: { enabled: tokenIn !== ZERO, refetchInterval: 4000 },
  });
  const decimals = (reads.data?.[0]?.result as number | undefined) ?? 18;
  const symbolIn = reads.data?.[1]?.result as string | undefined;
  const sym0 = (reads.data?.[2]?.result as string | undefined) ?? "T0";
  const sym1 = (reads.data?.[3]?.result as string | undefined) ?? "T1";
  const symbolOut = direction === 0 ? sym1 : sym0;
  const balance = reads.data?.[4]?.result as bigint | undefined;
  const allowance = (reads.data?.[5]?.result as bigint | undefined) ?? 0n;
  const myFee = (reads.data?.[6]?.result as number | undefined) ?? 3000;
  const t0Fee = (reads.data?.[7]?.result as number | undefined) ?? 3000;

  const amountWei = useMemo(() => {
    try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; }
  }, [amount, decimals]);

  // Estimated fees per side, purely UI math (assumes amountSpecified maps 1:1 onto token amount in fee accounting).
  const myFeeAmt = (amountWei * BigInt(myFee)) / 1_000_000n;
  const t0FeeAmt = (amountWei * BigInt(t0Fee)) / 1_000_000n;
  const savings = t0FeeAmt - myFeeAmt;

  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) reads.refetch();
  }, [isSuccess]);

  const needsApproval = allowance < amountWei;

  async function handleApprove() {
    const hash = await writeContractAsync({
      address: tokenIn,
      abi: erc20Abi,
      functionName: "approve",
      args: [ADDRESSES.router, maxUint256],
    } as any);
    setTxHash(hash);
  }

  async function handleSwap() {
    if (!account || amountWei === 0n) return;
    const zeroForOne = direction === 0;
    const hash = await writeContractAsync({
      address: ADDRESSES.router,
      abi: routerAbi,
      functionName: "swap",
      args: [
        POOL_KEY,
        {
          zeroForOne,
          amountSpecified: -amountWei,
          sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE_PLUS_1 : MAX_SQRT_PRICE_MINUS_1,
        },
      ],
    } as any);
    setTxHash(hash);
  }

  return (
    <div className="panel">
      <div className="row">
        <input
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
        <select value={direction} onChange={(e) => setDirection(Number(e.target.value) as 0 | 1)}>
          <option value={0}>{sym0} → {sym1}</option>
          <option value={1}>{sym1} → {sym0}</option>
        </select>
      </div>
      <div className="muted">
        Balance: {balance !== undefined ? shortNum(balance, decimals) : "—"} {symbolIn ?? ""}
      </div>

      {amountWei > 0n && myFee !== t0Fee && (
        <>
          <div className="fee-compare">
            <div className="fee-cell">
              <div className="label">Newcomer pays</div>
              <div className="num t0">{shortNum(t0FeeAmt, decimals)} {symbolIn}</div>
            </div>
            <div className="fee-arrow">→</div>
            <div className="fee-cell">
              <div className="label">You pay</div>
              <div className="num you">{shortNum(myFeeAmt, decimals)} {symbolIn}</div>
            </div>
          </div>
          <div className="fee-savings">
            You save {shortNum(savings, decimals)} {symbolIn} ({((1 - myFee / t0Fee) * 100).toFixed(0)}% off)
          </div>
        </>
      )}

      {!account ? (
        <div className="muted" style={{ textAlign: "center", marginTop: 16 }}>Connect wallet to swap</div>
      ) : needsApproval ? (
        <button className="btn" disabled={isPending || confirming || amountWei === 0n} onClick={handleApprove}>
          {isPending || confirming ? "Approving…" : `Approve ${symbolIn ?? ""}`}
        </button>
      ) : (
        <button className="btn" disabled={isPending || confirming || amountWei === 0n} onClick={handleSwap}>
          {isPending || confirming ? "Swapping…" : "Swap"}
        </button>
      )}
    </div>
  );
}

type Activity =
  | { kind: "swap"; volumeAdded: bigint; total: bigint; tier: number; ts: number; tx: `0x${string}` }
  | { kind: "promo"; tier: number; ts: number };

function ActivityPanel({ account }: { account?: `0x${string}` }) {
  const [items, setItems] = useState<Activity[]>([]);
  const lastTier = useRef<number | null>(null);
  const [showPromo, setShowPromo] = useState<number | null>(null);

  useWatchContractEvent({
    address: ADDRESSES.sbt,
    abi: sbtAbi as any,
    eventName: "Accrued",
    enabled: !!account,
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args ?? {};
        if (account && args.user?.toLowerCase() !== account.toLowerCase()) continue;
        const tier: number = Number(args.newTier ?? 0);
        const total: bigint = args.newTotal ?? 0n;
        const added: bigint = args.added ?? 0n;
        setItems((prev) => {
          const next: Activity[] = [
            { kind: "swap", volumeAdded: added, total, tier, ts: Date.now(), tx: (log as any).transactionHash },
            ...prev,
          ];
          // detect promotion
          if (lastTier.current !== null && tier > lastTier.current) {
            next.unshift({ kind: "promo", tier, ts: Date.now() });
            triggerPromo(tier);
          }
          lastTier.current = tier;
          return next.slice(0, 8);
        });
      }
    },
  });

  function triggerPromo(tier: number) {
    setShowPromo(tier);
    setTimeout(() => setShowPromo(null), 2400);
  }

  if (!account) return null;

  return (
    <>
      <div className="panel">
        <div className="brand" style={{ marginBottom: 8 }}>Recent hook activity</div>
        {items.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>
            Run a swap — every Accrued event from the SBT will appear here in real time.
          </div>
        ) : (
          items.map((it, i) =>
            it.kind === "promo" ? (
              <div key={`p${i}`} className="activity-row promo">
                ⬆ Promoted to {TIER_NAMES[it.tier]}
              </div>
            ) : (
              <div key={`s${i}`} className="activity-row">
                <div className="when">{formatRelative(it.ts)}</div>
                <div>
                  <div className="delta">+{shortNum(it.volumeAdded)} volume</div>
                  <div className="total">total {shortNum(it.total)} · T{it.tier}</div>
                </div>
                <a className="muted" href={`https://www.oklink.com/xlayer/tx/${it.tx}`} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>tx ↗</a>
              </div>
            )
          )
        )}
      </div>
      {showPromo !== null && <PromoOverlay tier={showPromo} />}
    </>
  );
}

function PromoOverlay({ tier }: { tier: number }) {
  return (
    <>
      <div className="promo-overlay">
        <div className="promo-card">
          <div className="small">Tier up</div>
          <div className="big">{TIER_NAMES[tier]}</div>
        </div>
      </div>
      <Confetti />
    </>
  );
}

function Confetti() {
  const dots = useMemo(() => {
    const arr: { color: string; dx: string; dy: string; delay: string }[] = [];
    const colors = ["#4f8cff", "#8a5cf7", "#f0c14b", "#4ade80", "#f87171"];
    for (let i = 0; i < 36; i++) {
      const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 200 + Math.random() * 240;
      arr.push({
        color: colors[i % colors.length],
        dx: `${Math.cos(angle) * dist}px`,
        dy: `${Math.sin(angle) * dist}px`,
        delay: `${Math.random() * 0.2}s`,
      });
    }
    return arr;
  }, []);
  return (
    <div className="confetti">
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            background: d.color,
            // @ts-expect-error css custom prop
            "--dx": d.dx, "--dy": d.dy,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

function Explainer() {
  return (
    <div className="panel">
      <div className="brand">How the hook works</div>
      <ul className="muted" style={{ marginTop: 8, lineHeight: 1.7, paddingLeft: 18 }}>
        <li><b>beforeSwap</b> reads your tier from the soulbound score and returns it as the LP fee for this swap.</li>
        <li><b>afterSwap</b> credits your address with the trade size, possibly promoting you.</li>
        <li>The score is non-transferable — every wallet builds its own loyalty curve on X Layer.</li>
      </ul>
    </div>
  );
}

function formatRelative(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}
