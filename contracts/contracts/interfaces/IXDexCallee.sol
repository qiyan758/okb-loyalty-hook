// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IXDexCallee {
    function xDexCall(address sender, uint amount0, uint amount1, bytes calldata data) external;
}
