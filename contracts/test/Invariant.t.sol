// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {InvariantTest} from "forge-std/InvariantTest.sol";
import {Token} from "../src/Token.sol";

/**
 * @title TokenInvariantTest
 * @notice Invariant testing for Token state machine
 * @dev Uses Foundry's invariant testing to verify correctness under random operations
 */
contract TokenInvariantTest is Test, InvariantTest {
    Token public token;
    TokenHandler public handler;

    address[] public actors;
    uint256 constant MAX_ACTORS = 10;

    function setUp() public {
        token = new Token();
        
        // Create test actors
        for (uint256 i = 0; i < MAX_ACTORS; i++) {
            address actor = address(uint160(i + 1));
            actors.push(actor);
            // Give each actor some initial tokens
            token.mint(actor, 1000000);
        }

        // Set up handler for invariant testing
        handler = new TokenHandler(token, actors);
        
        // Target the handler for fuzzing
        targetContract(address(handler));
    }

    /**
     * @notice Invariant: sum(balances) == totalSupply
     * @dev IMPORTANT: This can only verify the invariant for known accounts (actors)
     *      In production, we cannot enumerate all addresses with balances because
     *      mappings are not enumerable. However, in tests we track all actors,
     *      so we can verify the invariant for the accounts we know about.
     * 
     *      The full invariant is guaranteed by construction:
     *      - Mint: totalSupply and balances[to] both increase by same amount
     *      - Transfer: totalSupply unchanged, balances shift
     *      - Burn: totalSupply and balances[from] both decrease by same amount
     */
    function invariant_SumBalancesEqualsTotalSupply() public view {
        uint256 sum = 0;
        for (uint256 i = 0; i < actors.length; i++) {
            sum += token.balanceOf(actors[i]);
        }
        assertEq(sum, uint256(token.totalSupply()), "Invariant violated: sum(balances) != totalSupply");
    }

    /**
     * @notice Invariant: totalSupply >= 0 (should always be true, but good to check)
     */
    function invariant_TotalSupplyNonNegative() public view {
        assertGe(uint256(token.totalSupply()), 0, "Total supply cannot be negative");
    }

    /**
     * @notice Invariant: All balances >= 0
     */
    function invariant_AllBalancesNonNegative() public view {
        for (uint256 i = 0; i < actors.length; i++) {
            assertGe(token.balanceOf(actors[i]), 0, "Balance cannot be negative");
        }
    }
}

/**
 * @title TokenHandler
 * @notice Handler contract for invariant testing - performs random operations
 */
contract TokenHandler is Test {
    Token public token;
    address[] public actors;

    constructor(Token _token, address[] memory _actors) {
        token = _token;
        actors = _actors;
    }

    function mint(uint256 actorIndex, uint256 amount) public {
        actorIndex = bound(actorIndex, 0, actors.length - 1);
        amount = bound(amount, 1, 1000000);
        
        address to = actors[actorIndex];
        token.mint(to, amount);
    }

    function transfer(
        uint256 fromIndex,
        uint256 toIndex,
        uint256 amount
    ) public {
        fromIndex = bound(fromIndex, 0, actors.length - 1);
        toIndex = bound(toIndex, 0, actors.length - 1);
        
        address from = actors[fromIndex];
        address to = actors[toIndex];
        
        uint256 balance = token.balanceOf(from);
        if (balance == 0) return; // Skip if no balance
        
        amount = bound(amount, 1, balance);
        
        vm.prank(from);
        token.transfer(to, amount);
    }

    function burn(uint256 actorIndex, uint256 amount) public {
        actorIndex = bound(actorIndex, 0, actors.length - 1);
        
        address from = actors[actorIndex];
        uint256 balance = token.balanceOf(from);
        
        if (balance == 0) return; // Skip if no balance
        
        amount = bound(amount, 1, balance);
        
        vm.prank(from);
        token.burn(amount);
    }
}
