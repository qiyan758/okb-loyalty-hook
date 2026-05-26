const { ethers } = require("hardhat");

async function main() {
  const Probe = await ethers.getContractFactory("TstoreProbe");
  const p = await Probe.deploy();
  await p.waitForDeployment();
  console.log("Probe deployed at", await p.getAddress());
  try {
    const tx = await p.probe();
    const receipt = await tx.wait();
    console.log("probe() tx ok, gasUsed:", receipt.gasUsed.toString(), "status:", receipt.status);
  } catch (e) {
    console.log("probe() reverted:", e.shortMessage || e.message);
  }
  // also try staticCall
  try {
    const v = await p.probe.staticCall();
    console.log("probe.staticCall() ->", v.toString());
  } catch (e) {
    console.log("probe.staticCall() reverted:", e.shortMessage || e.message);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
