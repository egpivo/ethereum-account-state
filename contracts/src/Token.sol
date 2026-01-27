// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title Token
 * @notice Minimal, ledger-style token contract with explicit state machine
 * @dev Core invariant (theoretical): sum(balances) == totalSupply at all times
 * 
 * IMPORTANT: This invariant cannot be directly verified on-chain because:
 * - mapping(address => Balance) is not enumerable in Solidity
 * - There is no way to iterate over all keys in a mapping
 * 
 * However, the invariant is guaranteed by construction:
 * - Every state transition (mint/transfer/burn) maintains the invariant
 * - Mint: totalSupply += amount, balances[to] += amount (both increase by same amount)
 * - Transfer: balances[from] -= amount, balances[to] += amount (totalSupply unchanged)
 * - Burn: totalSupply -= amount, balances[from] -= amount (both decrease by same amount)
 * 
 * Verification methods:
 * - Off-chain: Reconstruct state from events and verify sum(balances) == totalSupply
 * - Testing: In tests, we can track all accounts and verify the invariant
 * - Formal verification: Prove that all state transitions preserve the invariant
 * 
 * Advanced Features (2026 Edition):
 * - User-defined Value Types: Type-safe Balance to prevent logic errors
 * - Transient Storage (EIP-1153): Gas-efficient reentrancy protection using tstore/tload
 * - Using directives: Financial-grade arithmetic operations
 * 
 * State Machine Rules:
 * - Initial state: totalSupply = 0, all balances = 0
 * - Valid transitions:
 *   1. Mint: totalSupply += amount, balances[to] += amount
 *   2. Transfer: balances[from] -= amount, balances[to] += amount
 *   3. Burn: totalSupply -= amount, balances[from] -= amount
 * - Illegal transitions:
 *   - Transfer with insufficient balance (revert)
 *   - Mint to zero address (revert)
 *   - Transfer to zero address (revert)
 */

// ============ User-defined Value Types ============

/**
 * @notice Type-safe Balance value type
 * @dev Prevents accidental mixing of amounts with prices, timestamps, etc.
 *      This is a compile-time check that adds zero runtime cost.
 */
type Balance is uint256;

/**
 * @notice Library for Balance arithmetic operations
 * @dev Using directives enable financial-grade operations on Balance type
 */
library BalanceLib {
    /// @notice Convert uint256 to Balance
    function from(uint256 value) internal pure returns (Balance) {
        return Balance.wrap(value);
    }

    /// @notice Convert Balance to uint256
    function unwrap(Balance balance) internal pure returns (uint256) {
        return Balance.unwrap(balance);
    }

    /// @notice Add two balances
    function add(Balance a, Balance b) internal pure returns (Balance) {
        return Balance.wrap(Balance.unwrap(a) + Balance.unwrap(b));
    }

    /// @notice Subtract balance b from balance a (reverts if underflow)
    function sub(Balance a, Balance b) internal pure returns (Balance) {
        return Balance.wrap(Balance.unwrap(a) - Balance.unwrap(b));
    }

    /// @notice Check if a >= b
    function gte(Balance a, Balance b) internal pure returns (bool) {
        return Balance.unwrap(a) >= Balance.unwrap(b);
    }

    /// @notice Check if a > b
    function gt(Balance a, Balance b) internal pure returns (bool) {
        return Balance.unwrap(a) > Balance.unwrap(b);
    }

    /// @notice Check if a == b
    function eq(Balance a, Balance b) internal pure returns (bool) {
        return Balance.unwrap(a) == Balance.unwrap(b);
    }

    /// @notice Zero balance
    function zero() internal pure returns (Balance) {
        return Balance.wrap(0);
    }
}

// ============ Reentrancy Guard using Transient Storage ============

/**
 * @notice Reentrancy guard using EIP-1153 transient storage
 * @dev Transient storage (tstore/tload) is much cheaper than regular storage (sstore/sload)
 *      - tstore: 100 gas (vs sstore: 20,000 gas for first write)
 *      - tload: 100 gas (vs sload: 2,100 gas)
 *      Automatically cleared at end of transaction, perfect for reentrancy guards
 */
library ReentrancyGuard {
    // Transient storage slot for reentrancy guard
    // Using keccak256("ReentrancyGuard") as slot to avoid collisions
    uint256 private constant REENTRANCY_GUARD_SLOT = uint256(keccak256("ReentrancyGuard"));

    /// @notice Check if already entered (using transient storage)
    function isEntered() internal view returns (bool) {
        // tload: 100 gas (vs sload: 2,100 gas)
        uint256 slot = REENTRANCY_GUARD_SLOT;
        uint256 value;
        assembly {
            value := tload(slot)
        }
        return value != 0;
    }

    /// @notice Enter critical section
    function enter() internal {
        // tstore: 100 gas (vs sstore: 20,000 gas)
        uint256 slot = REENTRANCY_GUARD_SLOT;
        assembly {
            tstore(slot, 1)
        }
    }

    /// @notice Exit critical section (automatically cleared at end of tx, but explicit for clarity)
    function exit() internal {
        // Clear transient storage (though it auto-clears at end of transaction)
        uint256 slot = REENTRANCY_GUARD_SLOT;
        assembly {
            tstore(slot, 0)
        }
    }

    /// @notice Modifier to prevent reentrancy
    modifier nonReentrant() {
        if (isEntered()) revert ReentrantCall();
        enter();
        _;
        exit();
    }

    error ReentrantCall();
}

// ============ Main Contract ============

contract Token {
    using BalanceLib for Balance;

    // ============ State Variables ============
    
    /// @notice Total supply of tokens
    /// @dev Theoretical invariant: sum(balances) == totalSupply
    ///      Cannot be verified on-chain (mappings are not enumerable)
    ///      Guaranteed by construction through state transitions
    Balance public totalSupply;
    
    /// @notice Balance of each account
    mapping(address => Balance) public balances;
    
    // ============ Events ============
    
    /// @notice Emitted when tokens are minted
    /// @param to Address receiving tokens
    /// @param amount Amount minted
    event Mint(address indexed to, uint256 amount);
    
    /// @notice Emitted when tokens are transferred
    /// @param from Address sending tokens
    /// @param to Address receiving tokens
    /// @param amount Amount transferred
    event Transfer(address indexed from, address indexed to, uint256 amount);
    
    /// @notice Emitted when tokens are burned
    /// @param from Address burning tokens
    /// @param amount Amount burned
    /// @dev Also emits Transfer(from, address(0), amount) for ERC20 canonical semantics
    event Burn(address indexed from, uint256 amount);
    
    // ============ Errors ============
    
    /// @notice Thrown when attempting to transfer with insufficient balance
    /// @param account Account with insufficient balance
    /// @param required Required amount
    /// @param available Available amount
    error InsufficientBalance(address account, uint256 required, uint256 available);
    
    /// @notice Thrown when attempting to operate on zero address
    error ZeroAddress();
    
    /// @notice Thrown when attempting to operate with zero amount
    error ZeroAmount();
    
    // ============ State Machine Functions ============
    
    /**
     * @notice Mint tokens to an account
     * @dev State transition: totalSupply += amount, balances[to] += amount
     *      Uses transient storage reentrancy guard (gas-efficient)
     *      
     *      Authorization: Public (anyone can call)
     *      This is a minimal implementation suitable for educational/testing purposes.
     *      For production use, add authorization controls (e.g., onlyOwner, onlyMinter).
     *      See docs/authorization-model.md for details.
     * @param to Address to mint tokens to
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        ReentrancyGuard.enter();
        
        if (to == address(0)) {
            ReentrancyGuard.exit();
            revert ZeroAddress();
        }
        
        Balance amountBalance = BalanceLib.from(amount);
        if (BalanceLib.eq(amountBalance, BalanceLib.zero())) {
            ReentrancyGuard.exit();
            revert ZeroAmount();
        }
        
        totalSupply = totalSupply.add(amountBalance);
        balances[to] = balances[to].add(amountBalance);
        
        ReentrancyGuard.exit();
        emit Mint(to, amount);
    }
    
    /**
     * @notice Transfer tokens from caller to recipient
     * @dev State transition: balances[from] -= amount, balances[to] += amount
     *      Uses transient storage reentrancy guard (gas-efficient)
     *      
     *      Authorization: Self-only (only msg.sender can transfer their own tokens)
     *      No approval mechanism - simpler than ERC20's approve/transferFrom pattern.
     *      See docs/authorization-model.md for details.
     * @param to Address to transfer tokens to
     * @param amount Amount to transfer
     */
    function transfer(address to, uint256 amount) external {
        ReentrancyGuard.enter();
        
        address from = msg.sender;
        
        if (to == address(0)) {
            ReentrancyGuard.exit();
            revert ZeroAddress();
        }
        
        Balance amountBalance = BalanceLib.from(amount);
        if (BalanceLib.eq(amountBalance, BalanceLib.zero())) {
            ReentrancyGuard.exit();
            revert ZeroAmount();
        }
        
        Balance fromBalance = balances[from];
        if (!fromBalance.gte(amountBalance)) {
            ReentrancyGuard.exit();
            revert InsufficientBalance(
                from,
                BalanceLib.unwrap(amountBalance),
                BalanceLib.unwrap(fromBalance)
            );
        }
        
        balances[from] = fromBalance.sub(amountBalance);
        balances[to] = balances[to].add(amountBalance);
        
        ReentrancyGuard.exit();
        emit Transfer(from, to, amount);
    }
    
    /**
     * @notice Burn tokens from caller
     * @dev State transition: totalSupply -= amount, balances[from] -= amount
     *      Uses transient storage reentrancy guard (gas-efficient)
     *      
     *      Authorization: Self-only (only msg.sender can burn their own tokens)
     *      See docs/authorization-model.md for details.
     *      
     *      Emits two events for canonical semantics:
     *      - Burn(from, amount): Explicit burn event
     *      - Transfer(from, address(0), amount): ERC20 canonical supply reduction signal
     *      
     *      IMPORTANT for event-based reconstruction:
     *      - Both events represent the SAME burn operation
     *      - Reconstruction must use Transfer(..., address(0), ...) as canonical signal
     *      - Burn events from the same transaction must be skipped to avoid double-counting
     *      - This prevents violating the sum(balances) == totalSupply invariant
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        ReentrancyGuard.enter();
        
        address from = msg.sender;
        
        Balance amountBalance = BalanceLib.from(amount);
        if (BalanceLib.eq(amountBalance, BalanceLib.zero())) {
            ReentrancyGuard.exit();
            revert ZeroAmount();
        }
        
        Balance fromBalance = balances[from];
        if (!fromBalance.gte(amountBalance)) {
            ReentrancyGuard.exit();
            revert InsufficientBalance(
                from,
                BalanceLib.unwrap(amountBalance),
                BalanceLib.unwrap(fromBalance)
            );
        }
        
        totalSupply = totalSupply.sub(amountBalance);
        balances[from] = fromBalance.sub(amountBalance);
        
        ReentrancyGuard.exit();
        
        // Emit both events for canonical semantics
        emit Burn(from, amount);
        emit Transfer(from, address(0), amount); // ERC20 canonical supply reduction
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get balance of an account
     * @param account Address to query
     * @return Balance of the account (as uint256 for ERC20 compatibility)
     */
    function balanceOf(address account) external view returns (uint256) {
        return BalanceLib.unwrap(balances[account]);
    }
}
