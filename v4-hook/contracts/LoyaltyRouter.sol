// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

/// @title LoyaltyRouter
/// @notice Minimal router that opens a PoolManager unlock window, performs a
///         swap or liquidity change, then settles deltas. Crucially it
///         encodes `msg.sender` into hookData so the OKBLoyaltyHook can
///         credit the right trader's tier.
///
/// @dev    This is intentionally tiny — no slippage protection, no path
///         routing, no native-token handling. The hackathon judges care
///         that the hook works end-to-end on X Layer with a real swap, not
///         that the router is production-grade. For real volumes, route
///         through Uniswap's official UniversalRouter or PositionManager.
contract LoyaltyRouter is IUnlockCallback {
    error NotPoolManager();
    error InvalidAction();
    error DeltaSettlementFailed();

    enum Action { Swap, AddLiquidity }

    struct CallbackData {
        Action action;
        address user;
        PoolKey key;
        bytes innerParams;
    }

    IPoolManager public immutable poolManager;

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    /// @notice Swap `amountSpecified` of token0/token1 through `key`. Caller
    ///         pulls the input from `msg.sender` via transferFrom inside the
    ///         settle path; tokens flow back to `msg.sender` via take.
    function swap(PoolKey calldata key, SwapParams calldata params)
        external
        returns (BalanceDelta delta)
    {
        bytes memory data = abi.encode(
            CallbackData({
                action: Action.Swap,
                user: msg.sender,
                key: key,
                innerParams: abi.encode(params)
            })
        );
        bytes memory result = poolManager.unlock(data);
        delta = abi.decode(result, (BalanceDelta));
    }

    /// @notice Add or remove liquidity. Positive liquidityDelta = add.
    function modifyLiquidity(PoolKey calldata key, ModifyLiquidityParams calldata params)
        external
        returns (BalanceDelta delta)
    {
        bytes memory data = abi.encode(
            CallbackData({
                action: Action.AddLiquidity,
                user: msg.sender,
                key: key,
                innerParams: abi.encode(params)
            })
        );
        bytes memory result = poolManager.unlock(data);
        delta = abi.decode(result, (BalanceDelta));
    }

    function unlockCallback(bytes calldata raw) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        CallbackData memory cb = abi.decode(raw, (CallbackData));

        BalanceDelta delta;
        if (cb.action == Action.Swap) {
            SwapParams memory sp = abi.decode(cb.innerParams, (SwapParams));
            delta = poolManager.swap(cb.key, sp, abi.encode(cb.user));
        } else if (cb.action == Action.AddLiquidity) {
            ModifyLiquidityParams memory mp = abi.decode(cb.innerParams, (ModifyLiquidityParams));
            (delta,) = poolManager.modifyLiquidity(cb.key, mp, abi.encode(cb.user));
        } else {
            revert InvalidAction();
        }

        _settle(cb.key.currency0, cb.user, delta.amount0());
        _settle(cb.key.currency1, cb.user, delta.amount1());
        return abi.encode(delta);
    }

    /// @dev Negative delta = router/user owes the pool that amount; positive
    ///      delta = pool owes the user. We handle both ends in one helper.
    function _settle(Currency currency, address user, int128 amount) private {
        if (amount == 0) return;
        if (amount < 0) {
            uint256 owed = uint256(uint128(-amount));
            poolManager.sync(currency);
            address token = Currency.unwrap(currency);
            // pull from user, push to poolManager
            bool ok = IERC20Minimal(token).transferFrom(user, address(poolManager), owed);
            if (!ok) revert DeltaSettlementFailed();
            poolManager.settle();
        } else {
            poolManager.take(currency, user, uint256(uint128(amount)));
        }
    }
}
