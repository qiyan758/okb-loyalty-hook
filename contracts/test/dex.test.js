const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("XDex AMM", function () {
  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("XDexFactory");
    const factory = await Factory.deploy(deployer.address);

    const WOKB = await ethers.getContractFactory("WOKB");
    const wokb = await WOKB.deploy();

    const Router = await ethers.getContractFactory("XDexRouter");
    const router = await Router.deploy(factory.target, wokb.target);

    const Token = await ethers.getContractFactory("MockERC20");
    const supply = ethers.parseUnits("1000000", 18);
    const tokenA = await Token.deploy("Alpha", "ALPHA", 18, supply);
    const tokenB = await Token.deploy("Beta", "BETA", 18, supply);

    await tokenA.transfer(alice.address, ethers.parseUnits("10000", 18));
    await tokenB.transfer(alice.address, ethers.parseUnits("10000", 18));
    await tokenA.transfer(bob.address, ethers.parseUnits("10000", 18));
    await tokenB.transfer(bob.address, ethers.parseUnits("10000", 18));

    return { deployer, alice, bob, factory, wokb, router, tokenA, tokenB };
  }

  it("creates a pair", async () => {
    const { factory, tokenA, tokenB } = await deployFixture();
    await expect(factory.createPair(tokenA.target, tokenB.target)).to.emit(factory, "PairCreated");
    expect(await factory.allPairsLength()).to.equal(1n);
  });

  it("adds liquidity, swaps, removes liquidity", async () => {
    const { alice, factory, router, tokenA, tokenB } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const amountA = ethers.parseUnits("1000", 18);
    const amountB = ethers.parseUnits("4000", 18);

    await tokenA.connect(alice).approve(router.target, ethers.MaxUint256);
    await tokenB.connect(alice).approve(router.target, ethers.MaxUint256);

    await router.connect(alice).addLiquidity(
      tokenA.target, tokenB.target, amountA, amountB, 0, 0, alice.address, deadline
    );

    const pairAddr = await factory.getPair(tokenA.target, tokenB.target);
    const Pair = await ethers.getContractFactory("XDexPair");
    const pair = Pair.attach(pairAddr);

    const lp = await pair.balanceOf(alice.address);
    expect(lp).to.be.gt(0n);

    const before = await tokenB.balanceOf(alice.address);
    await router.connect(alice).swapExactTokensForTokens(
      ethers.parseUnits("10", 18),
      0,
      [tokenA.target, tokenB.target],
      alice.address,
      deadline
    );
    const after = await tokenB.balanceOf(alice.address);
    expect(after).to.be.gt(before);

    await pair.connect(alice).approve(router.target, lp);
    await router.connect(alice).removeLiquidity(
      tokenA.target, tokenB.target, lp, 0, 0, alice.address, deadline
    );
    expect(await pair.balanceOf(alice.address)).to.equal(0n);
  });

  it("swaps native OKB for token via WOKB", async () => {
    const { alice, router, wokb, tokenA } = await deployFixture();
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    await tokenA.connect(alice).approve(router.target, ethers.MaxUint256);
    await router.connect(alice).addLiquidityOKB(
      tokenA.target,
      ethers.parseUnits("1000", 18),
      0, 0,
      alice.address,
      deadline,
      { value: ethers.parseEther("10") }
    );

    const before = await tokenA.balanceOf(alice.address);
    await router.connect(alice).swapExactOKBForTokens(
      0,
      [wokb.target, tokenA.target],
      alice.address,
      deadline,
      { value: ethers.parseEther("1") }
    );
    expect(await tokenA.balanceOf(alice.address)).to.be.gt(before);
  });
});
