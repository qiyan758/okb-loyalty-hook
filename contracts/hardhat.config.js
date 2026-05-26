require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "11".repeat(32);

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { allowUnlimitedContractSize: true },
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC || "https://testrpc.xlayer.tech",
      chainId: 1952,
      accounts: [PRIVATE_KEY],
    },
    xlayer: {
      url: process.env.XLAYER_RPC || "https://rpc.xlayer.tech",
      chainId: 196,
      accounts: [PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      xlayerTestnet: process.env.OKLINK_API_KEY || "any",
      xlayer: process.env.OKLINK_API_KEY || "any",
    },
    customChains: [
      {
        network: "xlayerTestnet",
        chainId: 195,
        urls: {
          apiURL: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER_TESTNET",
          browserURL: "https://www.oklink.com/xlayer-test",
        },
      },
      {
        network: "xlayer",
        chainId: 196,
        urls: {
          apiURL: "https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER",
          browserURL: "https://www.oklink.com/xlayer",
        },
      },
    ],
  },
};
