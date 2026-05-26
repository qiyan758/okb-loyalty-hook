// One-shot: pull real chain data so the video isn't lying.
// Reads xlayer.json + the demo swap receipt; writes a small JSON the video composition
// imports at build time.
const fs = require("fs");
const path = require("path");
const RPC = "https://rpc.xlayer.tech";

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(method + ": " + JSON.stringify(j.error));
  return j.result;
}

async function main() {
  const dep = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "deployments", "xlayer.json"), "utf8")
  );

  const swapHash = dep.txs.demoSwap;
  const receipt = await rpc("eth_getTransactionReceipt", [swapHash]);
  const block = await rpc("eth_getBlockByNumber", [receipt.blockNumber, false]);

  // SBT.Accrued event topic (keccak256("Accrued(address,uint256,uint256,uint8)"))
  const ACCRUED_TOPIC =
    "0x" +
    require("crypto")
      .createHash("sha256") // placeholder; real topic computed via viem below
      .update("placeholder")
      .digest("hex");

  // viem keccak via local install if any; otherwise rely on log presence.
  const accruedLog = receipt.logs.find(
    (l) => l.address.toLowerCase() === dep.contracts.sbt.toLowerCase()
  );

  const out = {
    network: dep.network,
    chainId: dep.chainId,
    contracts: dep.contracts,
    poolKey: dep.poolKey,
    config: dep.config,
    demoSwap: {
      hash: swapHash,
      blockNumber: parseInt(receipt.blockNumber, 16),
      gasUsed: parseInt(receipt.gasUsed, 16),
      status: parseInt(receipt.status, 16),
      timestamp: parseInt(block.timestamp, 16),
      logCount: receipt.logs.length,
      sbtLogPresent: !!accruedLog,
    },
    explorerBase: "https://www.oklink.com/xlayer",
  };

  const dst = path.join(__dirname, "src", "chain-data.json");
  fs.writeFileSync(dst, JSON.stringify(out, null, 2));
  console.log("wrote", dst);
  console.log("demo swap status:", out.demoSwap.status, "gasUsed:", out.demoSwap.gasUsed);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
