// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Force Hardhat to compile V4 PoolManager so getContractFactory can find its
// artifact. This file has no runtime purpose; it's only here to pull
// PoolManager into the artifact tree.
import "@uniswap/v4-core/src/PoolManager.sol";
