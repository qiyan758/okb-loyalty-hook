const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");
const { findHookSalt, FLAG } = require("./hook-miner.js");

const DYNAMIC_FEE_FLAG = 0x800000;
const Q96 = 2n ** 96n;
const SQRT_PRICE_1_1 = Q96;

// Official Uniswap V4 PoolManager pre-deployed on X Layer mainnet (chainId 196).
// Confirmed via probe-poolmanager.js + probe-unlock.js: initialize + unlock both work.
const PRE_DEPLOYED_POOL_MANAGERS = {
  xlayer: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32",
};

const TIER_THRESHOLDS = [
  ethers.parseUnits("100", 18),
  ethers.parseUnits("1000", 18),
  ethers.parseUnits("10000", 18),
];
const TIER_FEES = [3000, 2500, 1500, 500]; // 0.30 / 0.25 / 0.15 / 0.05 %

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:  ${network.name} (chainId=${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(balance)} OKB`);

  // 1. PoolManager: use pre-deployed when available (mainnet), else deploy fresh.
  let managerAddr = PRE_DEPLOYED_POOL_MANAGERS[network.name];
  if (managerAddr) {
    const code = await ethers.provider.getCode(managerAddr);
    if (code === "0x") throw new Error(`No code at pre-deployed PoolManager ${managerAddr}`);
    console.log(`PoolManager: ${managerAddr} (pre-deployed)`);
  } else {
    const PoolManager = await ethers.getContractFactory(
      "@uniswap/v4-core/src/PoolManager.sol:PoolManager"
    );
    const manager = await PoolManager.deploy(deployer.address);
    await manager.waitForDeployment();
    managerAddr = await manager.getAddress();
    console.log(`PoolManager: ${managerAddr} (freshly deployed)`);
  }
  const manager = await ethers.getContractAt(
    "@uniswap/v4-core/src/PoolManager.sol:PoolManager",
    managerAddr
  );

  // 2. Create2Deployer (used to mine the hook address)
  const Create2 = await ethers.getContractFactory("Create2Deployer");
  const create2 = await Create2.deploy();
  await create2.waitForDeployment();
  const create2Addr = await create2.getAddress();
  console.log(`Create2Deployer: ${create2Addr}`);

  // 3. LoyaltySBT (deployed first; hook wires to it after CREATE2 deploy)
  const SBT = await ethers.getContractFactory("LoyaltySBT");
  const sbt = await SBT.deploy(TIER_THRESHOLDS, TIER_FEES);
  await sbt.waitForDeployment();
  const sbtAddr = await sbt.getAddress();
  console.log(`LoyaltySBT:      ${sbtAddr}`);

  // 4. Mine hook salt
  const flags = FLAG.BEFORE_INITIALIZE | FLAG.BEFORE_SWAP | FLAG.AFTER_SWAP;
  const HookFactory = await ethers.getContractFactory("OKBLoyaltyHook");
  const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address"],
    [managerAddr, sbtAddr]
  );
  const { hookAddress, salt, iterations } = findHookSalt(
    create2Addr,
    flags,
    HookFactory.bytecode,
    constructorArgs
  );
  console.log(`Hook salt found in ${iterations} iters → ${hookAddress}`);

  // 5. Deploy hook via CREATE2 + lock SBT to it
  const initCode = ethers.concat([HookFactory.bytecode, constructorArgs]);
  const tx = await create2.deploy(initCode, salt);
  await tx.wait();
  await (await sbt.setHook(hookAddress)).wait();
  console.log(`OKBLoyaltyHook:  ${hookAddress}`);

  // 5. Mock tokens (ALPHA / BETA, sorted to satisfy currency0 < currency1)
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const tA = await ERC20.deploy("Alpha", "ALPHA", 18);
  const tB = await ERC20.deploy("Beta", "BETA", 18);
  await tA.waitForDeployment();
  await tB.waitForDeployment();
  const aAddr = (await tA.getAddress()).toLowerCase();
  const bAddr = (await tB.getAddress()).toLowerCase();
  const [token0, token1] = aAddr < bAddr ? [tA, tB] : [tB, tA];
  const c0 = await token0.getAddress();
  const c1 = await token1.getAddress();
  console.log(`token0: ${c0}`);
  console.log(`token1: ${c1}`);

  // Pre-mint a chunky float so anyone can demo
  const ONE_M = ethers.parseUnits("1000000", 18);
  await (await token0.mint(deployer.address, ONE_M)).wait();
  await (await token1.mint(deployer.address, ONE_M)).wait();

  // 6. Router
  const Router = await ethers.getContractFactory("LoyaltyRouter");
  const router = await Router.deploy(managerAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log(`LoyaltyRouter: ${routerAddr}`);

  // 7. Initialize the dynamic-fee pool
  const poolKey = {
    currency0: c0,
    currency1: c1,
    fee: DYNAMIC_FEE_FLAG,
    tickSpacing: 60,
    hooks: hookAddress,
  };
  await (await manager.initialize(poolKey, SQRT_PRICE_1_1)).wait();
  console.log(`Pool initialized at sqrtPriceX96 = ${SQRT_PRICE_1_1}`);

  // 8. Seed liquidity through the router
  await (await token0.approve(routerAddr, ethers.MaxUint256)).wait();
  await (await token1.approve(routerAddr, ethers.MaxUint256)).wait();
  await (await router.modifyLiquidity(poolKey, {
    tickLower: -600,
    tickUpper: 600,
    liquidityDelta: ethers.parseUnits("100000", 18),
    salt: ethers.ZeroHash,
  })).wait();
  console.log("Liquidity seeded: 100000 LP units in [-600, 600]");

  // 9. Demo swap to prove the hook fires end-to-end on chain.
  console.log("Running demo swap to fire the hook on chain ...");
  const MIN_SQRT_PRICE_PLUS_1 = 4295128740n;
  const swapTx = await router.swap(poolKey, {
    zeroForOne: true,
    amountSpecified: -ethers.parseUnits("10", 18),
    sqrtPriceLimitX96: MIN_SQRT_PRICE_PLUS_1,
  });
  const swapReceipt = await swapTx.wait();
  console.log(`Demo swap status=${swapReceipt.status} tx=${swapReceipt.hash}`);
  const tier = await sbt.tierOf(deployer.address);
  const volume = await sbt.volumeOf(deployer.address);
  console.log(`Post-swap: tier=${tier}, volume=${ethers.formatUnits(volume, 18)}`);

  // 10. Save deployments
  const out = {
    network: network.name,
    chainId: network.config.chainId,
    deployer: deployer.address,
    contracts: {
      poolManager: managerAddr,
      create2Deployer: create2Addr,
      hook: hookAddress,
      sbt: sbtAddr,
      router: routerAddr,
      token0: c0,
      token1: c1,
    },
    poolKey,
    config: {
      tierThresholds: TIER_THRESHOLDS.map(String),
      tierFees: TIER_FEES,
      sqrtPriceX96: SQRT_PRICE_1_1.toString(),
    },
    txs: {
      demoSwap: swapReceipt.hash,
    },
  };
  const dir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
