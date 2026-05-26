require("dotenv").config();
const { ethers } = require("ethers");
const path = require("path");

const FACTORY_ABI = [
  "function getPair(address,address) view returns (address)",
  "function allPairsLength() view returns (uint)",
];
const ERC20_ABI = [
  "function approve(address,uint256) returns (bool)",
  "function allowance(address,address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
const ROUTER_ABI = [
  "function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) returns (uint,uint,uint)",
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline) returns (uint[])",
  "function getAmountsOut(uint amountIn,address[] path) view returns (uint[])",
];
const PAIR_ABI = [
  "function getReserves() view returns (uint112,uint112,uint32)",
  "function balanceOf(address) view returns (uint256)",
  "function token0() view returns (address)",
];

const A = {
  factory: "0x4c7D5c441fd960cFf9794823976cdb6e72C69bC8",
  router:  "0xCCFFFBe32de325B3c7b2AdC29FF66462a4f47c3c",
  alpha:   "0xF146b0973100dc27AeaBcf33259E15aFF9BB5514",
  beta:    "0x7AFe6D72Cb5e9ac67ad30519C5c2AC2f6F10c70c",
};

(async () => {
  const provider = new ethers.JsonRpcProvider("https://testrpc.xlayer.tech");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  console.log("Account:", wallet.address);
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "OKB\n");

  const factory = new ethers.Contract(A.factory, FACTORY_ABI, wallet);
  const router  = new ethers.Contract(A.router, ROUTER_ABI, wallet);
  const alpha   = new ethers.Contract(A.alpha, ERC20_ABI, wallet);
  const beta    = new ethers.Contract(A.beta, ERC20_ABI, wallet);

  console.log("ALPHA balance:", ethers.formatUnits(await alpha.balanceOf(wallet.address), 18));
  console.log("BETA  balance:", ethers.formatUnits(await beta.balanceOf(wallet.address),  18));

  const deadline = BigInt(Math.floor(Date.now()/1000) + 1200);
  const aIn = ethers.parseUnits("1000", 18);
  const bIn = ethers.parseUnits("4000", 18);

  console.log("\n== 1. Approve ==");
  const allowanceA = await alpha.allowance(wallet.address, A.router);
  if (allowanceA < aIn) {
    const tx = await alpha.approve(A.router, ethers.MaxUint256);
    console.log("Approve ALPHA tx:", tx.hash);
    await tx.wait();
  } else { console.log("ALPHA already approved"); }
  const allowanceB = await beta.allowance(wallet.address, A.router);
  if (allowanceB < bIn) {
    const tx = await beta.approve(A.router, ethers.MaxUint256);
    console.log("Approve BETA  tx:", tx.hash);
    await tx.wait();
  } else { console.log("BETA already approved"); }

  console.log("\n== 2. Add Liquidity 1000 ALPHA + 4000 BETA ==");
  const pairsBefore = await factory.allPairsLength();
  const addTx = await router.addLiquidity(
    A.alpha, A.beta, aIn, bIn, 0, 0, wallet.address, deadline
  );
  console.log("addLiquidity tx:", addTx.hash);
  const addRcpt = await addTx.wait();
  console.log("Gas used:", addRcpt.gasUsed.toString());
  const pairsAfter = await factory.allPairsLength();
  console.log("Pairs:", pairsBefore.toString(), "->", pairsAfter.toString());

  const pairAddr = await factory.getPair(A.alpha, A.beta);
  console.log("Pair address:", pairAddr);
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, wallet);
  const [r0, r1] = await pair.getReserves();
  const t0 = await pair.token0();
  const [reserveA, reserveB] = t0.toLowerCase() === A.alpha.toLowerCase() ? [r0, r1] : [r1, r0];
  console.log("Reserves: ALPHA=", ethers.formatUnits(reserveA, 18), " BETA=", ethers.formatUnits(reserveB, 18));
  console.log("LP balance:", ethers.formatUnits(await pair.balanceOf(wallet.address), 18));

  console.log("\n== 3. Swap 10 ALPHA -> BETA ==");
  const amtIn = ethers.parseUnits("10", 18);
  const path = [A.alpha, A.beta];
  const amounts = await router.getAmountsOut(amtIn, path);
  console.log("Quoted out:", ethers.formatUnits(amounts[1], 18), "BETA");

  const betaBefore = await beta.balanceOf(wallet.address);
  const minOut = (amounts[1] * 995n) / 1000n;
  const swapTx = await router.swapExactTokensForTokens(
    amtIn, minOut, path, wallet.address, deadline
  );
  console.log("swap tx:", swapTx.hash);
  const swapRcpt = await swapTx.wait();
  console.log("Gas used:", swapRcpt.gasUsed.toString());
  const betaAfter = await beta.balanceOf(wallet.address);
  console.log("Actual out:", ethers.formatUnits(betaAfter - betaBefore, 18), "BETA");

  console.log("\nFinal:");
  console.log("ALPHA:", ethers.formatUnits(await alpha.balanceOf(wallet.address), 18));
  console.log("BETA: ", ethers.formatUnits(await beta.balanceOf(wallet.address),  18));
  console.log("OKB:  ", ethers.formatEther(await provider.getBalance(wallet.address)));
})().catch(e => { console.error(e); process.exit(1); });
