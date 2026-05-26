const { ethers } = require("hardhat");

const POOL_MANAGER = "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32";
const Q96 = 2n ** 96n;

// We need a real router that performs unlock+modifyLiquidity. Use our LoyaltyRouter.
async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "OKB");

  // Deploy two cheap tokens
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const a = await ERC20.deploy("X","X",18); await a.waitForDeployment();
  const b = await ERC20.deploy("Y","Y",18); await b.waitForDeployment();
  const aA = await a.getAddress(), bA = await b.getAddress();
  const [t0, t1] = aA.toLowerCase() < bA.toLowerCase() ? [a, b] : [b, a];
  const c0 = await t0.getAddress(), c1 = await t1.getAddress();
  console.log("c0:", c0, "c1:", c1);

  // Initialize a fresh pool (different salt to avoid the prior collision)
  const initIface = new ethers.Interface([
    "function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint160) returns (int24)"
  ]);
  const key = { currency0: c0, currency1: c1, fee: 3000, tickSpacing: 60, hooks: ethers.ZeroAddress };
  console.log("init pool ...");
  const initTx = await signer.sendTransaction({
    to: POOL_MANAGER,
    data: initIface.encodeFunctionData("initialize", [key, Q96]),
    gasLimit: 1_000_000,
  });
  const initR = await initTx.wait();
  console.log("  status:", initR.status, "gasUsed:", initR.gasUsed.toString());

  // Mint + approve
  const ONE_K = ethers.parseUnits("1000", 18);
  await (await t0.mint(signer.address, ONE_K)).wait();
  await (await t1.mint(signer.address, ONE_K)).wait();

  // Deploy LoyaltyRouter with this PoolManager
  const Router = await ethers.getContractFactory("LoyaltyRouter");
  const router = await Router.deploy(POOL_MANAGER);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("router:", routerAddr);

  await (await t0.approve(routerAddr, ethers.MaxUint256)).wait();
  await (await t1.approve(routerAddr, ethers.MaxUint256)).wait();

  // Try modifyLiquidity (this triggers unlock → tstore in PoolManager)
  console.log("modifyLiquidity (unlock path) ...");
  try {
    const tx = await router.modifyLiquidity(
      key,
      { tickLower: -600, tickUpper: 600, liquidityDelta: ethers.parseUnits("100", 18), salt: ethers.ZeroHash },
      { gasLimit: 4_000_000 }
    );
    const r = await tx.wait();
    console.log("  status:", r.status, "gasUsed:", r.gasUsed.toString(), "tx:", r.hash);
    console.log("  ✅ unlock + modifyLiquidity WORKS on X Layer mainnet");
  } catch (e) {
    console.log("  ❌ FAILED:", e.shortMessage || e.message);
    if (e.receipt) console.log("  receipt status:", e.receipt.status);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
