// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract TstoreProbe {
    function probe() external returns (uint256 round) {
        assembly {
            tstore(0, 42)
            round := tload(0)
        }
    }
}
