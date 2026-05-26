// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title LoyaltySBT
/// @notice Soulbound (non-transferable) trading volume tracker.
///         The hook is the only writer; anyone can read tiers.
///         Frontends render this as a "trader badge" — there is no ERC721 transferability.
contract LoyaltySBT {
    error NotHook();
    error HookAlreadySet();
    error NotOwner();

    /// @notice Set once at deploy time, then again exactly once via
    ///         {setHook}. We can't bake the hook address in at construction
    ///         because the hook itself depends on knowing the SBT's address
    ///         in its constructor — they are mutually referential.
    address public hook;
    address public immutable owner;

    /// @notice Total swap volume (in `amountSpecified` units of the pool's
    ///         currency0 base) accrued for each address, summed across all
    ///         pools that mount this hook.
    mapping(address => uint256) public volumeOf;

    /// @notice Cumulative swap count, useful for low-volume tier tests.
    mapping(address => uint64) public swapsOf;

    /// @notice Volume thresholds for each tier (cumulative, sorted asc).
    ///         Tier 0 = below tiers[0], Tier 1 = >= tiers[0], etc.
    /// @dev Set once at construction. We deliberately keep this immutable
    ///      so a single hook deployment cannot quietly re-tune thresholds
    ///      after liquidity has built up.
    uint256[3] public tierThresholds;

    /// @notice LP fees per tier in V4 hundredths-of-a-bp (1e6 = 100%).
    ///         T0 = fees[0], T1 = fees[1], T2 = fees[2], T3 = fees[3].
    uint24[4] public tierFees;

    event Accrued(address indexed user, uint256 added, uint256 newTotal, uint8 newTier);
    event HookSet(address indexed hook);

    constructor(uint256[3] memory _thresholds, uint24[4] memory _fees) {
        owner = msg.sender;
        tierThresholds = _thresholds;
        tierFees = _fees;
    }

    /// @notice Locks the SBT to a hook contract. Callable once by deployer.
    function setHook(address _hook) external {
        if (msg.sender != owner) revert NotOwner();
        if (hook != address(0)) revert HookAlreadySet();
        hook = _hook;
        emit HookSet(_hook);
    }

    modifier onlyHook() {
        if (msg.sender != hook) revert NotHook();
        _;
    }

    function accrue(address user, uint256 amount) external onlyHook {
        uint256 prev = volumeOf[user];
        uint256 next = prev + amount;
        volumeOf[user] = next;
        swapsOf[user] += 1;
        emit Accrued(user, amount, next, _tierFor(next));
    }

    function tierOf(address user) external view returns (uint8) {
        return _tierFor(volumeOf[user]);
    }

    function feeOf(address user) external view returns (uint24) {
        return tierFees[_tierFor(volumeOf[user])];
    }

    function _tierFor(uint256 vol) internal view returns (uint8) {
        if (vol >= tierThresholds[2]) return 3;
        if (vol >= tierThresholds[1]) return 2;
        if (vol >= tierThresholds[0]) return 1;
        return 0;
    }
}
