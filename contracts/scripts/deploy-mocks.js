const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXISTING = require("../deployments/xlayerTestnet.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying mocks from ${deployer.address}`);

  const Token = await ethers.getContractFactory("MockERC20");
  const supply = ethers.parseUnits("1000000", 18);
  const mockA = await Token.deploy("Alpha", "ALPHA", 18, supply);
  await mockA.waitForDeployment();
  const mockB = await Token.deploy("Beta", "BETA", 18, supply);
  await mockB.waitForDeployment();

  console.log(`MockA ALPHA: ${mockA.target}`);
  console.log(`MockB BETA:  ${mockB.target}`);

  const updated = { ...EXISTING, mocks: { ALPHA: mockA.target, BETA: mockB.target } };
  const outFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(updated, null, 2));
  console.log(`Saved -> ${outFile}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
