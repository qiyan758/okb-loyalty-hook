import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { xLayer, xLayerTestnet } from "./chains";
import { http } from "viem";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "00000000000000000000000000000000";

export const wagmiConfig = getDefaultConfig({
  appName: "OKB Loyalty Hook",
  projectId,
  chains: [xLayer, xLayerTestnet],
  transports: {
    [xLayer.id]: http(),
    [xLayerTestnet.id]: http(),
  },
  ssr: true,
});

const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const ADDRESSES = {
  poolManager: (process.env.NEXT_PUBLIC_POOL_MANAGER || ZERO) as `0x${string}`,
  hook: (process.env.NEXT_PUBLIC_HOOK || ZERO) as `0x${string}`,
  sbt: (process.env.NEXT_PUBLIC_SBT || ZERO) as `0x${string}`,
  router: (process.env.NEXT_PUBLIC_ROUTER || ZERO) as `0x${string}`,
  token0: (process.env.NEXT_PUBLIC_TOKEN0 || ZERO) as `0x${string}`,
  token1: (process.env.NEXT_PUBLIC_TOKEN1 || ZERO) as `0x${string}`,
};

export const POOL_KEY = {
  currency0: ADDRESSES.token0,
  currency1: ADDRESSES.token1,
  fee: 0x800000, // DYNAMIC_FEE_FLAG — hook overrides per-swap
  tickSpacing: 60,
  hooks: ADDRESSES.hook,
} as const;

// MIN_SQRT_PRICE+1 from V4-core TickMath. Used as price limit for zeroForOne swaps
// so the swap consumes everything available without explicit price targeting.
export const MIN_SQRT_PRICE_PLUS_1 = 4295128740n;
// MAX_SQRT_PRICE-1, mirror for oneForZero swaps.
export const MAX_SQRT_PRICE_MINUS_1 = 1461446703485210103287273052203988822378723970341n;

export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN || 196);
