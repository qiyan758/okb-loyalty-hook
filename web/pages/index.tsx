import { useEffect, useMemo, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
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
  // V4 fees are in hundredths of a bp (1e6 = 100%). 3000 -> 0.30%
  return (fee / 10000).toFixed(2);
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
            Contracts are not configured. Deploy via <code>v4-hook/scripts/deploy.js</code> and copy the
            addresses from <code>v4-hook/deployments/&lt;network&gt;.json</code> into <code>web/.env.local</code>.
          </div>
        )}
        {configured && (
          <>
            <TierCard account={address} />
            <SwapPanel account={address} />
            <Explainer />
          </>
        )}
      </div>
    </>
  );
}

function TierCard({ account }: { account?: `0x${string}` }) {
  const reads = useReadContracts({
    contracts: [
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "feeOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "volumeOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "swapsOf", args: account ? [account] : undefined },
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [1n] }, // tier 2 boundary
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [0n] }, // tier 1 boundary
      { address: ADDRESSES.sbt, abi: sbtAbi, functionName: "tierThresholds", args: [2n] }, // tier 3 boundary
    ],
    query: { enabled: !!account, refetchInterval: 5000 },
  });

  if (!account) return <div className="panel muted">Connect a wallet to see your tier.</div>;
  const tier = (reads.data?.[0]?.result as number | undefined) ?? 0;
  const fee = (reads.data?.[1]?.result as number | undefined) ?? 3000;
  const volume = (reads.data?.[2]?.result as bigint | undefined) ?? 0n;
  const swaps = (reads.data?.[3]?.result as bigint | undefined) ?? 0n;
  const t1 = (reads.data?.[5]?.result as bigint | undefined) ?? 0n;
  const t2 = (reads.data?.[4]?.result as bigint | undefined) ?? 0n;
  const t3 = (reads.data?.[6]?.result as bigint | undefined) ?? 0n;
  const nextTarget = tier === 0 ? t1 : tier === 1 ? t2 : tier === 2 ? t3 : null;

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted">Your tier</div>
          <div className="brand">{TIER_NAMES[tier] ?? "?"} (T{tier})</div>
        </div>
        <div>
          <div className="muted">Current fee</div>
          <div className="brand">{feePct(fee)}%</div>
        </div>
      </div>
      <div className="muted" style={{ marginTop: 12 }}>
        Volume: {formatUnits(volume, 18)} · Swaps: {swaps.toString()}
      </div>
      {nextTarget !== null && (
        <div className="muted">
          Next tier at {formatUnits(nextTarget, 18)} volume — {formatUnits(nextTarget - volume, 18)} to go
        </div>
      )}
    </div>
  );
}

function SwapPanel({ account }: { account?: `0x${string}` }) {
  const [direction, setDirection] = useState<0 | 1>(0); // 0: token0->token1, 1: token1->token0
  const tokenIn = direction === 0 ? ADDRESSES.token0 : ADDRESSES.token1;
  const tokenOut = direction === 0 ? ADDRESSES.token1 : ADDRESSES.token0;
  const [amount, setAmount] = useState("");

  const reads = useReadContracts({
    contracts: [
      { address: tokenIn, abi: erc20Abi, functionName: "decimals" },
      { address: tokenIn, abi: erc20Abi, functionName: "symbol" },
      { address: tokenOut, abi: erc20Abi, functionName: "symbol" },
      { address: tokenIn, abi: erc20Abi, functionName: "balanceOf", args: account ? [account] : undefined },
      { address: tokenIn, abi: erc20Abi, functionName: "allowance", args: account ? [account, ADDRESSES.router] : undefined },
    ],
    query: { enabled: tokenIn !== ZERO },
  });
  const decimals = (reads.data?.[0]?.result as number | undefined) ?? 18;
  const symbolIn = reads.data?.[1]?.result as string | undefined;
  const symbolOut = reads.data?.[2]?.result as string | undefined;
  const balance = reads.data?.[3]?.result as bigint | undefined;
  const allowance = (reads.data?.[4]?.result as bigint | undefined) ?? 0n;

  const amountWei = useMemo(() => {
    try { return amount ? parseUnits(amount, decimals) : 0n; } catch { return 0n; }
  }, [amount, decimals]);

  const { writeContractAsync, isPending } = useWriteContract();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Force refetch when a swap confirms so the tier card animates.
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
          <option value={0}>{symbolIn ?? "T0"} → {symbolOut ?? "T1"}</option>
          <option value={1}>{symbolOut ?? "T1"} → {symbolIn ?? "T0"}</option>
        </select>
      </div>
      <div className="muted">
        Balance: {balance !== undefined ? formatUnits(balance, decimals) : "—"} {symbolIn ?? ""}
      </div>

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

function Explainer() {
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="brand">How the hook works</div>
      <ul className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
        <li><b>beforeSwap</b> reads your tier from the soulbound score and returns it as the LP fee for this swap.</li>
        <li><b>afterSwap</b> credits your address with the trade size, possibly promoting you to the next tier.</li>
        <li>The score is non-transferable — every wallet builds its own loyalty curve on X Layer.</li>
      </ul>
    </div>
  );
}
