// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {LoyaltySBT} from "./LoyaltySBT.sol";

/// @title OKBLoyaltyHook
/// @notice Uniswap V4 hook that turns trading volume on X Layer into a tiered
///         fee discount. Each address gets a soulbound volume score; the more
///         a wallet trades through pools mounting this hook, the lower the
///         LP fee they pay on subsequent swaps.
///
/// @dev    Pools must be initialized with `fee == LPFeeLibrary.DYNAMIC_FEE_FLAG`
///         so beforeSwap can override the per-swap fee. The user identity is
///         passed through `hookData` (encoded as `abi.encode(address user)`)
///         because `msg.sender` at the PoolManager boundary is the router, not
///         the trader. The companion LoyaltyRouter is the trusted source of
///         this field.
contract OKBLoyaltyHook is BaseHook {
    using LPFeeLibrary for uint24;

    error PoolMustBeDynamicFee();

    LoyaltySBT public immutable sbt;

    /// @notice The hook is wired to a *pre-deployed* SBT whose immutable
    ///         `hook` field already points at this contract's predicted
    ///         CREATE2 address. We do NOT instantiate the SBT here:
    ///         the hook constructor must be small enough to fit inside a
    ///         CREATE2 deploy, and nesting another `new` call has been
    ///         observed to silently no-op on some L2 RPC providers.
    constructor(IPoolManager _manager, LoyaltySBT _sbt) BaseHook(_manager) {
        sbt = _sbt;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Reject pools that aren't dynamic-fee — the whole point of this
    ///         hook is to override the fee per swap, which is only honored
    ///         when the pool's fee field equals DYNAMIC_FEE_FLAG.
    function _beforeInitialize(address, PoolKey calldata key, uint160) internal pure override returns (bytes4) {
        if (!key.fee.isDynamicFee()) revert PoolMustBeDynamicFee();
        return BaseHook.beforeInitialize.selector;
    }

    /// @notice Decide the LP fee for this swap based on the trader's tier.
    ///         If `hookData` is empty (raw PoolManager.swap, no router), we
    ///         return the highest fee tier so anonymous flow doesn't get a
    ///         discount.
    function _beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata hookData)
        internal
        view
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        address user = _decodeUser(hookData);
        uint24 fee = user == address(0) ? sbt.tierFees(0) : sbt.feeOf(user);
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /// @notice After a successful swap, credit the trader's score with the
    ///         absolute value of the specified amount. We use amountSpecified
    ///         as a proxy for "size" — it's measured in token0 or token1
    ///         units depending on direction, which is good enough for tiering
    ///         in a demo. Production would normalize via an oracle.
    function _afterSwap(address, PoolKey calldata, SwapParams calldata params, BalanceDelta, bytes calldata hookData)
        internal
        override
        returns (bytes4, int128)
    {
        address user = _decodeUser(hookData);
        if (user != address(0)) {
            uint256 size = params.amountSpecified < 0
                ? uint256(-params.amountSpecified)
                : uint256(params.amountSpecified);
            sbt.accrue(user, size);
        }
        return (BaseHook.afterSwap.selector, 0);
    }

    function _decodeUser(bytes calldata hookData) private pure returns (address) {
        if (hookData.length < 32) return address(0);
        return abi.decode(hookData, (address));
    }
}
