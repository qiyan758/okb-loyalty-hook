const { ethers } = require("hardhat");

const FLAG_MASK = (1n << 14n) - 1n; // 0x3FFF
const MAX_LOOP = 160_444;

// Match Uniswap V4 hook flag bit layout (Hooks.sol).
const FLAG = {
  BEFORE_INITIALIZE: 1n << 13n,
  AFTER_INITIALIZE: 1n << 12n,
  BEFORE_ADD_LIQUIDITY: 1n << 11n,
  AFTER_ADD_LIQUIDITY: 1n << 10n,
  BEFORE_REMOVE_LIQUIDITY: 1n << 9n,
  AFTER_REMOVE_LIQUIDITY: 1n << 8n,
  BEFORE_SWAP: 1n << 7n,
  AFTER_SWAP: 1n << 6n,
  BEFORE_DONATE: 1n << 5n,
  AFTER_DONATE: 1n << 4n,
  BEFORE_SWAP_RETURNS_DELTA: 1n << 3n,
  AFTER_SWAP_RETURNS_DELTA: 1n << 2n,
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA: 1n << 1n,
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA: 1n << 0n,
};

function computeCreate2Address(deployer, salt, initCodeHash) {
  // keccak256( 0xff ++ deployer ++ salt ++ keccak256(initCode) )[12..]
  const packed = ethers.solidityPacked(
    ["bytes1", "address", "bytes32", "bytes32"],
    ["0xff", deployer, salt, initCodeHash]
  );
  return ethers.getAddress("0x" + ethers.keccak256(packed).slice(-40));
}

/// Find a CREATE2 salt s.t. the deployed address's lowest 14 bits == flags.
function findHookSalt(deployer, flags, creationCode, constructorArgs) {
  const initCode = ethers.concat([creationCode, constructorArgs]);
  const initCodeHash = ethers.keccak256(initCode);
  const target = BigInt(flags) & FLAG_MASK;

  for (let i = 0; i < MAX_LOOP; i++) {
    const salt = ethers.toBeHex(i, 32);
    const addr = computeCreate2Address(deployer, salt, initCodeHash);
    if ((BigInt(addr) & FLAG_MASK) === target) {
      return { hookAddress: addr, salt, iterations: i };
    }
  }
  throw new Error("HookMiner: no salt found within MAX_LOOP");
}

module.exports = { findHookSalt, computeCreate2Address, FLAG, FLAG_MASK };
