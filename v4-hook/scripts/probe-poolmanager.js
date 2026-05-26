const { ethers } = require("hardhat");

const POOL_MANAGER = "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32";
const Q96 = 2n ** 96n;

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(signer.address)), "OKB");

  // Deploy two cheap mock tokens
  const ERC20 = await ethers.getContractFactory("MockERC20");
  const a = await ERC20.deploy("X","X",18); await a.waitForDeployment();
  const b = await ERC20.deploy("Y","Y",18); await b.waitForDeployment();
  const aA = await a.getAddress(), bA = await b.getAddress();
  const [c0, c1] = aA.toLowerCase() < bA.toLowerCase() ? [aA, bA] : [bA, aA];
  console.log("currency0:", c0);
  console.log("currency1:", c1);

  // PoolManager.initialize(PoolKey, sqrtPriceX96)
  const iface = new ethers.Interface([
    "function initialize((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks),uint160) returns (int24)"
  ]);
  const key = {
    currency0: c0,
    currency1: c1,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  console.log("Calling PoolManager.initialize at", POOL_MANAGER);
  try {
    const tx = await signer.sendTransaction({
      to: POOL_MANAGER,
      data: iface.encodeFunctionData("initialize", [key, Q96]),
      gasLimit: 1_000_000,
    });
    const r = await tx.wait();
    console.log("status:", r.status, "gasUsed:", r.gasUsed.toString(), "tx:", r.hash);
  } catch (e) {
    console.log("FAILED:", e.shortMessage || e.message);
    if (e.receipt) console.log("status:", e.receipt.status);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
