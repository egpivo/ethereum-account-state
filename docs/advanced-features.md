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
// Won't compile:
Balance amount = BalanceLib.from(1000);
uint256 price = 50;
Balance total = amount.add(price); // Error!

// Works:
Balance amount1 = BalanceLib.from(1000);
Balance amount2 = BalanceLib.from(500);
Balance total = amount1.add(amount2); // Type-safe
```

## 2. Using Directives

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

    Balance amountBalance = BalanceLib.from(amount);
    Balance fromBalance = balances[msg.sender];

    if (!fromBalance.gte(amountBalance)) revert InsufficientBalance();

    balances[msg.sender] = fromBalance.sub(amountBalance);  // Type-safe
    balances[to] = balances[to].add(amountBalance);          // Readable

}
```

This demonstrates: modern Solidity features, type safety, protocol-grade quality.

## Version Requirements

- **Solidity**: ^0.8.28
- **EVM Version**: Cancun
- **Foundry**: Latest version
