// Minimal ABIs for the V4 hook demo. Hand-written so the frontend isn't
// pinned to a specific Hardhat artifact path and can be served standalone.

export const erc20Abi = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

export const sbtAbi = [
  { type: "function", name: "volumeOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "swapsOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "tierOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint8" }] },
  { type: "function", name: "feeOf", stateMutability: "view", inputs: [{ name: "user", type: "address" }], outputs: [{ type: "uint24" }] },
  { type: "function", name: "tierFees", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint24" }] },
  { type: "function", name: "tierThresholds", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const poolKeyTuple = {
  type: "tuple",
  components: [
    { name: "currency0", type: "address" },
    { name: "currency1", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "tickSpacing", type: "int24" },
    { name: "hooks", type: "address" },
  ],
} as const;

const swapParamsTuple = {
  type: "tuple",
  components: [
    { name: "zeroForOne", type: "bool" },
    { name: "amountSpecified", type: "int256" },
    { name: "sqrtPriceLimitX96", type: "uint160" },
  ],
} as const;

export const routerAbi = [
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "key", ...poolKeyTuple },
      { name: "params", ...swapParamsTuple },
    ],
    outputs: [{ name: "delta", type: "int256" }],
  },
] as const;
