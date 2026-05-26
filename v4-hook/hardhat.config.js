require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: __dirname + "/.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "11".repeat(32);

module.exports = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      hardfork: "cancun",
    },
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC || "https://testrpc.xlayer.tech",
      chainId: 1952,
      accounts: [PRIVATE_KEY],
    },
    xlayer: {
      url: process.env.XLAYER_RPC || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [PRIVATE_KEY],
      gasPrice: 30_000_000, // 30 Mwei; mainnet baseFee ~20 Mwei observed
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
