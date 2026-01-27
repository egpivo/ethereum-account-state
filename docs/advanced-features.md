# Advanced Features: Solidity 0.8.28

## Overview

This document explains the advanced Solidity features used in the Token contract.

## 1. User-defined Value Types (Balance)

**What**: Type-safe wrapper around `uint256` to prevent logic errors.

**Implementation**:
```solidity
type Balance is uint256;

library BalanceLib {
    function from(uint256 value) internal pure returns (Balance) {
        return Balance.wrap(value);
    }
    function add(Balance a, Balance b) internal pure returns (Balance) {
        return Balance.wrap(Balance.unwrap(a) + Balance.unwrap(b));
    }
    // ... more operations
}
```

**Benefits**:
- Prevents mixing amounts with prices, timestamps, or other `uint256` values
- Zero runtime cost (compile-time check)
- Protocol-grade code quality

**Example**:
```solidity
// ❌ Won't compile:
Balance amount = BalanceLib.from(1000);
uint256 price = 50;
Balance total = amount.add(price); // Error!

// ✅ Works:
Balance amount1 = BalanceLib.from(1000);
Balance amount2 = BalanceLib.from(500);
Balance total = amount1.add(amount2); // Type-safe
```

## 2. Transient Storage (EIP-1153)

**What**: Storage that persists only during a single transaction, automatically cleared at the end.

**Gas Costs**:
- `tstore`: 100 gas (vs `sstore`: 20,000 gas first write)
- `tload`: 100 gas (vs `sload`: 2,100 gas cold read)

**Implementation**:
```solidity
library ReentrancyGuard {
    uint256 private constant REENTRANCY_GUARD_SLOT = 
        uint256(keccak256("ReentrancyGuard"));

    function enter() internal {
        uint256 slot = REENTRANCY_GUARD_SLOT;
        assembly {
            tstore(slot, 1)
        }
    }
}
```

**Context**: This minimal token doesn't strictly need reentrancy guard (no external calls), but we include it for:
1. **Defensive Programming**: Future extensions may introduce reentrancy risks
2. **Educational Value**: Demonstrates proper use of transient storage
3. **Minimal Cost**: Only ~200 gas per operation
4. **Best Practice**: Following security best practices from the start

**When to Use**: Reentrancy guards, temporary flags, cross-function state within a transaction.

## 3. Using Directives

**What**: Attach library functions to types, enabling method-style syntax.

**Implementation**:
```solidity
using BalanceLib for Balance;

// Method-style:
totalSupply = totalSupply.add(amountBalance);
balances[to] = balances[to].add(amountBalance);

// Instead of:
totalSupply = BalanceLib.add(totalSupply, amountBalance);
```

**Benefits**:
- Improved readability
- Type safety
- Audit-friendly code

**Example**:
```solidity
// Without using:
BalanceLib.add(BalanceLib.sub(balance, amount), fee)

// With using:
balance.sub(amount).add(fee)
```

## Combined Effect

```solidity
function transfer(address to, uint256 amount) external {
    ReentrancyGuard.enter();  // tstore: 100 gas
    
    Balance amountBalance = BalanceLib.from(amount);
    Balance fromBalance = balances[msg.sender];
    
    if (!fromBalance.gte(amountBalance)) revert InsufficientBalance();
    
    balances[msg.sender] = fromBalance.sub(amountBalance);  // Type-safe
    balances[to] = balances[to].add(amountBalance);          // Readable
    
    ReentrancyGuard.exit();
}
```

This demonstrates: modern Solidity features, gas-efficient patterns, type safety, protocol-grade quality.

## Version Requirements

- **Solidity**: ^0.8.28
- **EVM Version**: Cancun (required for EIP-1153)
- **Foundry**: Latest version with Cancun support
