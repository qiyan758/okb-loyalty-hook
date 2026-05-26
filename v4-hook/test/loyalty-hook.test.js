const { expect } = require("chai");
const { ethers } = require("hardhat");
const { findHookSalt, FLAG } = require("../scripts/hook-miner.js");

const DYNAMIC_FEE_FLAG = 0x800000;
const Q96 = 2n ** 96n;

// sqrt(1) * 2^96 — used for 1:1 initialization
const SQRT_PRICE_1_1 = Q96;

const TIER_THRESHOLDS = [
  ethers.parseUnits("100", 18),
  ethers.parseUnits("1000", 18),
  ethers.parseUnits("10000", 18),
];
const TIER_FEES = [3000, 2500, 1500, 500]; // 0.30%, 0.25%, 0.15%, 0.05%

describe("OKBLoyaltyHook", function () {
  let manager, deployer, miner, hook, sbt, router;
  let token0, token1, currency0, currency1;
  let owner, trader;
  let poolKey;

  before(async function () {
    [owner, trader] = await ethers.getSigners();

    // Deploy V4 PoolManager (constructor: address protocolOwner)
    const PoolManager = await ethers.getContractFactory(
      "@uniswap/v4-core/src/PoolManager.sol:PoolManager"
    );
    manager = await PoolManager.deploy(owner.address);

    // CREATE2 deployer for hook address mining
    const Create2Deployer = await ethers.getContractFactory("Create2Deployer");
    miner = await Create2Deployer.deploy();

    // Deploy LoyaltySBT first; hook will be wired to it after.
    const SBT = await ethers.getContractFactory("LoyaltySBT");
    sbt = await SBT.deploy(TIER_THRESHOLDS, TIER_FEES);

    // Mine a hook address whose lowest 14 bits == BEFORE_INITIALIZE | BEFORE_SWAP | AFTER_SWAP
    const flags = FLAG.BEFORE_INITIALIZE | FLAG.BEFORE_SWAP | FLAG.AFTER_SWAP;
    const HookFactory = await ethers.getContractFactory("OKBLoyaltyHook");
    const creationCode = HookFactory.bytecode;
    const constructorArgs = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address"],
      [await manager.getAddress(), await sbt.getAddress()]
    );

    const { hookAddress, salt } = findHookSalt(
      await miner.getAddress(),
      flags,
      creationCode,
      constructorArgs
    );

    // Deploy hook via CREATE2 at the mined address
    const initCode = ethers.concat([creationCode, constructorArgs]);
    const tx = await miner.deploy(initCode, salt);
    await tx.wait();
    hook = HookFactory.attach(hookAddress);

    // Lock SBT to the deployed hook so only the hook can accrue volume.
    await sbt.setHook(hookAddress);

    // Tokens
    const ERC20 = await ethers.getContractFactory("MockERC20");
    const tA = await ERC20.deploy("Alpha", "ALPHA", 18);
    const tB = await ERC20.deploy("Beta", "BETA", 18);
    [token0, token1] =
      (await tA.getAddress()).toLowerCase() < (await tB.getAddress()).toLowerCase()
        ? [tA, tB]
        : [tB, tA];
    currency0 = await token0.getAddress();
    currency1 = await token1.getAddress();

    // Router
    const Router = await ethers.getContractFactory("LoyaltyRouter");
    router = await Router.deploy(await manager.getAddress());

    // Fund traders
    await token0.mint(trader.address, ethers.parseUnits("1000000", 18));
    await token1.mint(trader.address, ethers.parseUnits("1000000", 18));
    await token0.mint(owner.address, ethers.parseUnits("1000000", 18));
    await token1.mint(owner.address, ethers.parseUnits("1000000", 18));

    await token0.connect(trader).approve(await router.getAddress(), ethers.MaxUint256);
    await token1.connect(trader).approve(await router.getAddress(), ethers.MaxUint256);
    await token0.approve(await router.getAddress(), ethers.MaxUint256);
    await token1.approve(await router.getAddress(), ethers.MaxUint256);

    // Pool key with dynamic fee flag
    poolKey = {
      currency0,
      currency1,
      fee: DYNAMIC_FEE_FLAG,
      tickSpacing: 60,
      hooks: hookAddress,
    };

    await manager.initialize(poolKey, SQRT_PRICE_1_1);

    // Add liquidity (-600..600 range, ~symmetric around price 1)
    await router.modifyLiquidity(poolKey, {
      tickLower: -600,
      tickUpper: 600,
      liquidityDelta: ethers.parseUnits("100000", 18),
      salt: ethers.ZeroHash,
    });
  });

  it("hook address has the expected permission flags", async () => {
    const addr = await hook.getAddress();
    const lower14 = BigInt(addr) & ((1n << 14n) - 1n);
    const expected = FLAG.BEFORE_INITIALIZE | FLAG.BEFORE_SWAP | FLAG.AFTER_SWAP;
    expect(lower14).to.equal(expected);
  });

  it("rejects initialization of non-dynamic-fee pools", async () => {
    const badKey = { ...poolKey, fee: 3000 };
    await expect(manager.initialize(badKey, SQRT_PRICE_1_1)).to.be.reverted;
  });

  it("starts trader at tier 0 with the highest fee", async () => {
    expect(await sbt.tierOf(trader.address)).to.equal(0);
    expect(await sbt.feeOf(trader.address)).to.equal(TIER_FEES[0]);
  });

  it("accrues volume on swap and emits Accrued", async () => {
    const amount = ethers.parseUnits("50", 18);
    const tx = await router.connect(trader).swap(poolKey, {
      zeroForOne: true,
      amountSpecified: -amount, // exact-input
      sqrtPriceLimitX96: BigInt("4295128740"), // MIN_SQRT_PRICE+1
    });
    await expect(tx).to.emit(sbt, "Accrued");
    expect(await sbt.volumeOf(trader.address)).to.equal(amount);
    expect(await sbt.swapsOf(trader.address)).to.equal(1n);
  });

  it("promotes trader through tiers as volume crosses thresholds", async () => {
    // already at 50, push to >=100 (tier 1)
    await router.connect(trader).swap(poolKey, {
      zeroForOne: true,
      amountSpecified: -ethers.parseUnits("60", 18),
      sqrtPriceLimitX96: BigInt("4295128740"),
    });
    expect(await sbt.tierOf(trader.address)).to.equal(1);
    expect(await sbt.feeOf(trader.address)).to.equal(TIER_FEES[1]);

    // push to >=1000 (tier 2): need ~890 more
    await router.connect(trader).swap(poolKey, {
      zeroForOne: true,
      amountSpecified: -ethers.parseUnits("900", 18),
      sqrtPriceLimitX96: BigInt("4295128740"),
    });
    expect(await sbt.tierOf(trader.address)).to.equal(2);
    expect(await sbt.feeOf(trader.address)).to.equal(TIER_FEES[2]);
  });

  it("LoyaltySBT.accrue rejects non-hook callers", async () => {
    await expect(
      sbt.connect(trader).accrue(trader.address, 1)
    ).to.be.revertedWithCustomError(sbt, "NotHook");
  });
});
