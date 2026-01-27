// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Token} from "../src/Token.sol";

/**
 * @title TokenTest
 * @notice Comprehensive tests for Token state machine
 * @dev Tests cover:
 * - Successful state transitions
 * - Illegal transitions (reverts)
 * - Invariant preservation
 * - Edge cases
 */
contract TokenTest is Test {
    Token public token;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public zero = address(0);

    event Mint(address indexed to, uint256 amount);
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    function setUp() public {
        token = new Token();
    }

    // ============ Mint Tests ============

    function test_Mint_Success() public {
        uint256 amount = 1000;
        vm.prank(alice);
        token.mint(alice, amount);

        assertEq(token.balanceOf(alice), amount);
        assertEq(uint256(token.totalSupply()), amount);
    }

    function test_Mint_ZeroAddress_Reverts() public {
        vm.expectRevert(Token.ZeroAddress.selector);
        token.mint(zero, 1000);
    }

    function test_Mint_ZeroAmount_Reverts() public {
        vm.expectRevert(Token.ZeroAmount.selector);
        token.mint(alice, 0);
    }

    function test_Mint_EmitsEvent() public {
        uint256 amount = 1000;
        vm.expectEmit(true, false, false, true);
        emit Mint(alice, amount);
        token.mint(alice, amount);
    }

    // ============ Transfer Tests ============

    function test_Transfer_Success() public {
        uint256 mintAmount = 1000;
        uint256 transferAmount = 300;

        token.mint(alice, mintAmount);
        vm.prank(alice);
        token.transfer(bob, transferAmount);

        assertEq(token.balanceOf(alice), mintAmount - transferAmount);
        assertEq(token.balanceOf(bob), transferAmount);
        assertEq(uint256(token.totalSupply()), mintAmount); // Supply unchanged
    }

    function test_Transfer_InsufficientBalance_Reverts() public {
        uint256 mintAmount = 1000;
        uint256 transferAmount = 1500;

        token.mint(alice, mintAmount);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Token.InsufficientBalance.selector,
                alice,
                transferAmount,
                mintAmount
            )
        );
        token.transfer(bob, transferAmount);
    }

    function test_Transfer_ZeroAddress_Reverts() public {
        token.mint(alice, 1000);
        vm.prank(alice);
        vm.expectRevert(Token.ZeroAddress.selector);
        token.transfer(zero, 100);
    }

    function test_Transfer_ZeroAmount_Reverts() public {
        token.mint(alice, 1000);
        vm.prank(alice);
        vm.expectRevert(Token.ZeroAmount.selector);
        token.transfer(bob, 0);
    }

    function test_Transfer_EmitsEvent() public {
        token.mint(alice, 1000);
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, bob, 300);
        vm.prank(alice);
        token.transfer(bob, 300);
    }

    // ============ Burn Tests ============

    function test_Burn_Success() public {
        uint256 mintAmount = 1000;
        uint256 burnAmount = 300;

        token.mint(alice, mintAmount);
        vm.prank(alice);
        token.burn(burnAmount);

        assertEq(token.balanceOf(alice), mintAmount - burnAmount);
        assertEq(uint256(token.totalSupply()), mintAmount - burnAmount);
    }

    function test_Burn_InsufficientBalance_Reverts() public {
        uint256 mintAmount = 1000;
        uint256 burnAmount = 1500;

        token.mint(alice, mintAmount);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                Token.InsufficientBalance.selector,
                alice,
                burnAmount,
                mintAmount
            )
        );
        token.burn(burnAmount);
    }

    function test_Burn_ZeroAmount_Reverts() public {
        token.mint(alice, 1000);
        vm.prank(alice);
        vm.expectRevert(Token.ZeroAmount.selector);
        token.burn(0);
    }

    function test_Burn_EmitsEvent() public {
        token.mint(alice, 1000);
        vm.expectEmit(true, false, false, true);
        emit Burn(alice, 300);
        vm.prank(alice);
        token.burn(300);
    }

    function test_Burn_EmitsBothEvents() public {
        token.mint(alice, 1000);
        
        // Burn emits both Burn and Transfer(..., address(0), ...) events
        vm.expectEmit(true, false, false, true);
        emit Burn(alice, 300);
        
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, address(0), 300);
        
        vm.prank(alice);
        token.burn(300);
    }

    // ============ Invariant Tests ============

    function test_Invariant_SumBalancesEqualsTotalSupply() public {
        // Setup: mint to multiple accounts
        token.mint(alice, 1000);
        token.mint(bob, 2000);

        // Transfer
        vm.prank(alice);
        token.transfer(bob, 300);

        // Burn
        vm.prank(bob);
        token.burn(500);

        // Verify invariant: sum(balances) == totalSupply
        // Note: This only verifies for known accounts. In production,
        // we cannot enumerate all addresses, but the invariant is guaranteed by construction.
        uint256 aliceBalance = token.balanceOf(alice);
        uint256 bobBalance = token.balanceOf(bob);
        uint256 totalSupply = uint256(token.totalSupply());

        assertEq(aliceBalance + bobBalance, totalSupply);
    }

    function test_Invariant_PreservedAfterMultipleOperations() public {
        // Complex sequence of operations
        token.mint(alice, 10000);
        token.mint(bob, 5000);

        vm.prank(alice);
        token.transfer(bob, 2000);

        vm.prank(bob);
        token.burn(1000);

        vm.prank(alice);
        token.transfer(bob, 500);

        vm.prank(bob);
        token.burn(500);

        // Verify invariant
        uint256 sum = token.balanceOf(alice) + token.balanceOf(bob);
        assertEq(sum, uint256(token.totalSupply()));
    }

    // ============ Edge Cases ============

    function test_Transfer_ExactBalance() public {
        uint256 amount = 1000;
        token.mint(alice, amount);
        vm.prank(alice);
        token.transfer(bob, amount);

        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(bob), amount);
    }

    function test_Burn_ExactBalance() public {
        uint256 amount = 1000;
        token.mint(alice, amount);
        vm.prank(alice);
        token.burn(amount);

        assertEq(token.balanceOf(alice), 0);
        assertEq(uint256(token.totalSupply()), 0);
    }

    function test_MultipleMints_Accumulate() public {
        token.mint(alice, 1000);
        token.mint(alice, 2000);
        token.mint(alice, 3000);

        assertEq(token.balanceOf(alice), 6000);
        assertEq(uint256(token.totalSupply()), 6000);
    }

    // ============ Fuzz Tests ============

    function testFuzz_Mint_Invariant(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount < type(uint256).max / 2); // Avoid overflow

        token.mint(alice, amount);
        assertEq(token.balanceOf(alice), amount);
        assertEq(uint256(token.totalSupply()), amount);
    }

    function testFuzz_Transfer_Invariant(
        uint256 mintAmount,
        uint256 transferAmount
    ) public {
        vm.assume(mintAmount > 0);
        vm.assume(transferAmount > 0);
        vm.assume(transferAmount <= mintAmount);
        vm.assume(mintAmount < type(uint256).max / 2);

        token.mint(alice, mintAmount);
        vm.prank(alice);
        token.transfer(bob, transferAmount);

        assertEq(
            token.balanceOf(alice) + token.balanceOf(bob),
            uint256(token.totalSupply())
        );
        assertEq(uint256(token.totalSupply()), mintAmount);
    }
}
