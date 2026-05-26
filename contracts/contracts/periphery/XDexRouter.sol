// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IERC20.sol";
import "../interfaces/IXDexFactory.sol";
import "../interfaces/IXDexPair.sol";
import "../interfaces/IWOKB.sol";
import "../libraries/XDexLibrary.sol";

contract XDexRouter {
    address public immutable factory;
    address public immutable WOKB;

    modifier ensure(uint deadline) {
        require(deadline >= block.timestamp, "XDexRouter: EXPIRED");
        _;
    }

    constructor(address _factory, address _WOKB) {
        factory = _factory;
        WOKB = _WOKB;
    }

    receive() external payable {
        require(msg.sender == WOKB, "XDexRouter: ONLY_WOKB");
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin
    ) internal returns (uint amountA, uint amountB) {
        if (IXDexFactory(factory).getPair(tokenA, tokenB) == address(0)) {
            IXDexFactory(factory).createPair(tokenA, tokenB);
        }
        (uint reserveA, uint reserveB) = XDexLibrary.getReserves(factory, tokenA, tokenB);
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint amountBOptimal = XDexLibrary.quote(amountADesired, reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(amountBOptimal >= amountBMin, "XDexRouter: INSUFFICIENT_B_AMOUNT");
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint amountAOptimal = XDexLibrary.quote(amountBDesired, reserveB, reserveA);
                require(amountAOptimal <= amountADesired);
                require(amountAOptimal >= amountAMin, "XDexRouter: INSUFFICIENT_A_AMOUNT");
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint amountA, uint amountB, uint liquidity) {
        (amountA, amountB) = _addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin);
        address pair = XDexLibrary.pairFor(factory, tokenA, tokenB);
        _safeTransferFrom(tokenA, msg.sender, pair, amountA);
        _safeTransferFrom(tokenB, msg.sender, pair, amountB);
        liquidity = IXDexPair(pair).mint(to);
    }

    function addLiquidityOKB(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountOKBMin,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns (uint amountToken, uint amountOKB, uint liquidity) {
        (amountToken, amountOKB) = _addLiquidity(
            token, WOKB, amountTokenDesired, msg.value, amountTokenMin, amountOKBMin
        );
        address pair = XDexLibrary.pairFor(factory, token, WOKB);
        _safeTransferFrom(token, msg.sender, pair, amountToken);
        IWOKB(WOKB).deposit{value: amountOKB}();
        require(IWOKB(WOKB).transfer(pair, amountOKB), "XDexRouter: WOKB_TRANSFER_FAILED");
        liquidity = IXDexPair(pair).mint(to);
        if (msg.value > amountOKB) _safeTransferOKB(msg.sender, msg.value - amountOKB);
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint liquidity,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) public ensure(deadline) returns (uint amountA, uint amountB) {
        address pair = XDexLibrary.pairFor(factory, tokenA, tokenB);
        IXDexPair(pair).transferFrom(msg.sender, pair, liquidity);
        (uint amount0, uint amount1) = IXDexPair(pair).burn(to);
        (address token0, ) = XDexLibrary.sortTokens(tokenA, tokenB);
        (amountA, amountB) = tokenA == token0 ? (amount0, amount1) : (amount1, amount0);
        require(amountA >= amountAMin, "XDexRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "XDexRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityOKB(
        address token,
        uint liquidity,
        uint amountTokenMin,
        uint amountOKBMin,
        address to,
        uint deadline
    ) public ensure(deadline) returns (uint amountToken, uint amountOKB) {
        (amountToken, amountOKB) = removeLiquidity(
            token, WOKB, liquidity, amountTokenMin, amountOKBMin, address(this), deadline
        );
        _safeTransfer(token, to, amountToken);
        IWOKB(WOKB).withdraw(amountOKB);
        _safeTransferOKB(to, amountOKB);
    }

    function _swap(uint[] memory amounts, address[] memory path, address _to) internal {
        for (uint i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = XDexLibrary.sortTokens(input, output);
            uint amountOut = amounts[i + 1];
            (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
            address to = i < path.length - 2 ? XDexLibrary.pairFor(factory, output, path[i + 2]) : _to;
            IXDexPair(XDexLibrary.pairFor(factory, input, output)).swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }

    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        amounts = XDexLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "XDexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        _safeTransferFrom(path[0], msg.sender, XDexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        amounts = XDexLibrary.getAmountsIn(factory, amountOut, path);
        require(amounts[0] <= amountInMax, "XDexRouter: EXCESSIVE_INPUT_AMOUNT");
        _safeTransferFrom(path[0], msg.sender, XDexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, to);
    }

    function swapExactOKBForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable ensure(deadline) returns (uint[] memory amounts) {
        require(path[0] == WOKB, "XDexRouter: INVALID_PATH");
        amounts = XDexLibrary.getAmountsOut(factory, msg.value, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "XDexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        IWOKB(WOKB).deposit{value: amounts[0]}();
        require(IWOKB(WOKB).transfer(XDexLibrary.pairFor(factory, path[0], path[1]), amounts[0]));
        _swap(amounts, path, to);
    }

    function swapExactTokensForOKB(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external ensure(deadline) returns (uint[] memory amounts) {
        require(path[path.length - 1] == WOKB, "XDexRouter: INVALID_PATH");
        amounts = XDexLibrary.getAmountsOut(factory, amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "XDexRouter: INSUFFICIENT_OUTPUT_AMOUNT");
        _safeTransferFrom(path[0], msg.sender, XDexLibrary.pairFor(factory, path[0], path[1]), amounts[0]);
        _swap(amounts, path, address(this));
        IWOKB(WOKB).withdraw(amounts[amounts.length - 1]);
        _safeTransferOKB(to, amounts[amounts.length - 1]);
    }

    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint) {
        return XDexLibrary.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint) {
        return XDexLibrary.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint) {
        return XDexLibrary.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory) {
        return XDexLibrary.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory) {
        return XDexLibrary.getAmountsIn(factory, amountOut, path);
    }

    function _safeTransfer(address token, address to, uint value) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "XDexRouter: TRANSFER_FAILED");
    }

    function _safeTransferFrom(address token, address from, address to, uint value) private {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "XDexRouter: TRANSFER_FROM_FAILED");
    }

    function _safeTransferOKB(address to, uint value) private {
        (bool ok, ) = to.call{value: value}(new bytes(0));
        require(ok, "XDexRouter: OKB_TRANSFER_FAILED");
    }
}
