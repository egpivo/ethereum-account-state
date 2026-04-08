// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Token, Balance, BalanceLib} from "../src/Token.sol";

/**
 * @title TokenHalmosTest
 * @notice Symbolic tests for formal verification with Halmos
 * @dev Functions prefixed with `check_` are verified symbolically by Halmos.
 *      Unlike fuzz tests (probabilistic), Halmos proves properties hold for ALL inputs.
 */
contract TokenHalmosTest is Test {
    Token public token;

    function setUp() public {
        token = new Token();
    }

    // =========================================================================
    // Invariant: mint preserves sum(balances) == totalSupply
    // =========================================================================

    /// @notice Prove: after mint, totalSupply increases by exactly `amount`
    function check_mint_increases_totalSupply(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= type(uint128).max); // bound to avoid overflow

        uint256 supplyBefore = Balance.unwrap(token.totalSupply());

        token.mint(to, amount);

        uint256 supplyAfter = Balance.unwrap(token.totalSupply());
        assert(supplyAfter == supplyBefore + amount);
    }

    /// @notice Prove: after mint, recipient balance increases by exactly `amount`
    function check_mint_increases_balance(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= type(uint128).max);

        uint256 balanceBefore = token.balanceOf(to);

        token.mint(to, amount);

        uint256 balanceAfter = token.balanceOf(to);
        assert(balanceAfter == balanceBefore + amount);
    }

    // =========================================================================
    // Invariant: transfer preserves totalSupply
    // =========================================================================

    /// @notice Prove: transfer does not change totalSupply
    function check_transfer_preserves_totalSupply(
        address from,
        address to,
        uint256 mintAmount,
        uint256 transferAmount
    ) public {
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(mintAmount > 0 && mintAmount <= type(uint128).max);
        vm.assume(transferAmount > 0 && transferAmount <= mintAmount);

        // Setup: give `from` some tokens
        token.mint(from, mintAmount);
        uint256 supplyAfterMint = Balance.unwrap(token.totalSupply());

        // Transfer
        vm.prank(from);
        token.transfer(to, transferAmount);

        uint256 supplyAfterTransfer = Balance.unwrap(token.totalSupply());
        assert(supplyAfterTransfer == supplyAfterMint);
    }

    // =========================================================================
    // Invariant: burn decreases totalSupply by exactly `amount`
    // =========================================================================

    /// @notice Prove: after burn, totalSupply decreases by exactly `amount`
    function check_burn_decreases_totalSupply(
        address from,
        uint256 mintAmount,
        uint256 burnAmount
    ) public {
        vm.assume(from != address(0));
        vm.assume(mintAmount > 0 && mintAmount <= type(uint128).max);
        vm.assume(burnAmount > 0 && burnAmount <= mintAmount);

        token.mint(from, mintAmount);
        uint256 supplyAfterMint = Balance.unwrap(token.totalSupply());

        vm.prank(from);
        token.burn(burnAmount);

        uint256 supplyAfterBurn = Balance.unwrap(token.totalSupply());
        assert(supplyAfterBurn == supplyAfterMint - burnAmount);
    }

    // =========================================================================
    // Revert conditions
    // =========================================================================

    /// @notice Prove: mint to address(0) always reverts
    function check_mint_reverts_on_zero_address(uint256 amount) public {
        vm.assume(amount > 0);
        try token.mint(address(0), amount) {
            assert(false); // should not reach here
        } catch {
            // expected revert
        }
    }

    /// @notice Prove: mint with zero amount always reverts
    function check_mint_reverts_on_zero_amount(address to) public {
        vm.assume(to != address(0));
        try token.mint(to, 0) {
            assert(false); // should not reach here
        } catch {
            // expected revert
        }
    }

    /// @notice Prove: transfer with insufficient balance always reverts
    function check_transfer_reverts_on_insufficient_balance(
        address from,
        address to,
        uint256 mintAmount,
        uint256 transferAmount
    ) public {
        vm.assume(from != address(0));
        vm.assume(to != address(0));
        vm.assume(mintAmount > 0 && mintAmount <= type(uint128).max);
        vm.assume(transferAmount > mintAmount); // more than available

        token.mint(from, mintAmount);

        vm.prank(from);
        try token.transfer(to, transferAmount) {
            assert(false); // should not reach here
        } catch {
            // expected revert
        }
    }

    // =========================================================================
    // BalanceLib safety
    // =========================================================================

    /// @notice Prove: BalanceLib.add does not overflow (within uint128 range)
    function check_balancelib_add_no_overflow(uint256 a, uint256 b) public pure {
        vm.assume(a <= type(uint128).max);
        vm.assume(b <= type(uint128).max);

        Balance ba = Balance.wrap(a);
        Balance bb = Balance.wrap(b);
        Balance result = BalanceLib.add(ba, bb);

        assert(Balance.unwrap(result) == a + b);
    }

    /// @notice Prove: BalanceLib.sub is correct when a >= b
    function check_balancelib_sub_correct(uint256 a, uint256 b) public pure {
        vm.assume(a >= b);

        Balance ba = Balance.wrap(a);
        Balance bb = Balance.wrap(b);
        Balance result = BalanceLib.sub(ba, bb);

        assert(Balance.unwrap(result) == a - b);
    }
}
