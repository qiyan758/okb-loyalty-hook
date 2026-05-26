// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Create2Deployer
/// @notice Deploys arbitrary contracts via CREATE2 with a caller-supplied
///         salt. Used to deploy V4 hooks at addresses whose lowest 14 bits
///         encode the required permission flags.
contract Create2Deployer {
    error DeployFailed();

    event Deployed(address addr, bytes32 salt);

    function deploy(bytes memory creationCode, bytes32 salt) external returns (address addr) {
        assembly {
            addr := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();
        emit Deployed(addr, salt);
    }

    function computeAddress(bytes32 codeHash, bytes32 salt) external view returns (address) {
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, codeHash))))
        );
    }
}
