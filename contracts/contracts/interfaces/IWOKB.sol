// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IWOKB {
    function deposit() external payable;
    function withdraw(uint) external;
    function transfer(address to, uint value) external returns (bool);
    function approve(address spender, uint value) external returns (bool);
    function balanceOf(address) external view returns (uint);
}
