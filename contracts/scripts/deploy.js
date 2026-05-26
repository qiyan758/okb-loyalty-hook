const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const KNOWN_WOKB = {
  196: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`Deploying on chainId=${chainId} from ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} OKB`);

  const Factory = await ethers.getContractFactory("XDexFactory");
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();
  console.log(`XDexFactory:  ${factory.target}`);

  let wokbAddress = KNOWN_WOKB[chainId];
  if (!wokbAddress) {
    const WOKB = await ethers.getContractFactory("WOKB");
    const wokb = await WOKB.deploy();
    await wokb.waitForDeployment();
    wokbAddress = wokb.target;
    console.log(`WOKB (new):   ${wokbAddress}`);
  } else {
    console.log(`WOKB (known): ${wokbAddress}`);
  }

  const Router = await ethers.getContractFactory("XDexRouter");
  const router = await Router.deploy(factory.target, wokbAddress);
  await router.waitForDeployment();
  console.log(`XDexRouter:   ${router.target}`);

  let mockA, mockB;
  if (chainId === 1952 || chainId === 195 || chainId === 31337) {
    const Token = await ethers.getContractFactory("MockERC20");
    const supply = ethers.parseUnits("1000000", 18);
    mockA = await Token.deploy("Alpha", "ALPHA", 18, supply);
    mockB = await Token.deploy("Beta", "BETA", 18, supply);
    await mockA.waitForDeployment();
    await mockB.waitForDeployment();
    console.log(`MockA ALPHA:  ${mockA.target}`);
    console.log(`MockB BETA:   ${mockB.target}`);
  }

  const out = {
    chainId,
    deployer: deployer.address,
    factory: factory.target,
    wokb: wokbAddress,
    router: router.target,
    initCodeHash: ethers.keccak256(
      (await ethers.getContractFactory("XDexPair")).bytecode
    ),
    mocks: mockA ? { ALPHA: mockA.target, BETA: mockB.target } : undefined,
  };

  const outDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`Saved -> ${outFile}`);
  console.log(out);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
