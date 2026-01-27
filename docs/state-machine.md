# Token State Machine Specification

## Overview

This document defines the state machine for the Token contract, including state definitions, valid transitions, and illegal operations.

## State Definition

### Core State Variables

- `totalSupply: Balance` - Total supply of tokens in existence (User-defined Value Type)
- `balances: mapping(address => Balance)` - Balance of each account (User-defined Value Type)

### Advanced Features (2026 Edition)

#### User-defined Value Types

The contract uses Solidity 0.8.28's **User-defined Value Types** feature to create a type-safe `Balance` type:

```solidity
type Balance is uint256;
```

**Benefits**:
- **Type Safety**: Prevents accidental mixing of amounts with prices, timestamps, or other uint256 values
- **Zero Runtime Cost**: Compile-time check, no gas overhead
- **Financial-Grade Code**: Makes the code look like a financial protocol, not an entry-level contract

#### Transient Storage (EIP-1153)

The contract uses **Transient Storage** (`tstore`/`tload`) for reentrancy protection:

**Gas Savings**:
- `tstore`: 100 gas (vs `sstore`: 20,000 gas for first write)
- `tload`: 100 gas (vs `sload`: 2,100 gas)
- **~200x cheaper** for reentrancy guards!

**How it works**:
- Transient storage is automatically cleared at the end of the transaction
- Perfect for reentrancy guards that only need to persist during a single transaction
- No need to manually clear state (though we do it explicitly for clarity)

#### Using Directives

The contract uses `using` directives to enable financial-grade arithmetic operations:

```solidity
using BalanceLib for Balance;

// Now you can write:
totalSupply = totalSupply.add(amountBalance);
balances[to] = balances[to].add(amountBalance);
```

This makes the code more readable and type-safe.

### Invariant

**Critical Invariant (Theoretical)**: `sum(balances) == totalSupply` must hold at all times.

**Important Limitation**: This invariant **cannot be directly verified on-chain** because:
- `mapping(address => Balance)` is not enumerable in Solidity
- There is no way to iterate over all keys in a mapping
- Ethereum does not provide a mechanism to enumerate mapping keys

**Why This Invariant Still Matters**:
- It is **guaranteed by construction** through state transitions
- Every operation maintains the invariant:
  - Mint: Both `totalSupply` and `balances[to]` increase by the same amount
  - Transfer: `totalSupply` unchanged, balances shift between accounts
  - Burn: Both `totalSupply` and `balances[from]` decrease by the same amount

**Verification Methods** (off-chain):
1. **Event Reconstruction**: Replay all events and verify `sum(balances) == totalSupply`
2. **Testing**: Track all accounts in tests and verify the invariant
3. **Formal Verification**: Prove mathematically that all transitions preserve the invariant
4. **Audit**: Manual verification of state transition logic

This invariant ensures:
- No tokens are created or destroyed without proper accounting
- The ledger remains consistent
- State can be verified and audited (off-chain)

## State Transitions

### 1. Mint (Creation)

**Function**: `mint(address to, uint256 amount)`

**Preconditions**:
- `to != address(0)` (zero address check)
- `amount > 0` (non-zero amount)

**State Transition**:
```
totalSupply: S → S + amount
balances[to]: B → B + amount
```

**Postconditions**:
- `totalSupply` increased by `amount`
- `balances[to]` increased by `amount`
- Invariant preserved: `sum(balances) == totalSupply`

**Events**: `Mint(to, amount)`

**Illegal Transitions**:
- Minting to zero address → `ZeroAddress` error
- Minting zero amount → `ZeroAmount` error

### 2. Transfer (Movement)

**Function**: `transfer(address to, uint256 amount)`

**Preconditions**:
- `to != address(0)` (zero address check)
- `amount > 0` (non-zero amount)
- `balances[msg.sender] >= amount` (sufficient balance)

**State Transition**:
```
balances[from]: B_from → B_from - amount
balances[to]: B_to → B_to + amount
totalSupply: S → S (unchanged)
```

**Postconditions**:
- `balances[from]` decreased by `amount`
- `balances[to]` increased by `amount`
- `totalSupply` unchanged
- Invariant preserved: `sum(balances) == totalSupply`

**Events**: `Transfer(from, to, amount)`

**Illegal Transitions**:
- Transfer to zero address → `ZeroAddress` error
- Transfer zero amount → `ZeroAmount` error
- Insufficient balance → `InsufficientBalance` error

### 3. Burn (Destruction)

**Function**: `burn(uint256 amount)`

**Preconditions**:
- `amount > 0` (non-zero amount)
- `balances[msg.sender] >= amount` (sufficient balance)

**State Transition**:
```
totalSupply: S → S - amount
balances[from]: B → B - amount
```

**Postconditions**:
- `totalSupply` decreased by `amount`
- `balances[from]` decreased by `amount`
- Invariant preserved: `sum(balances) == totalSupply`

**Events**:
- `Burn(from, amount)` - Explicit burn event
- `Transfer(from, address(0), amount)` - ERC20 canonical supply reduction signal

**Event Semantics**:
The `Transfer` event to `address(0)` is the ERC20 standard way to signal token destruction.
This dual-event emission ensures:
1. **Explicit semantics**: `Burn` event clearly indicates intentional destruction
2. **ERC20 compatibility**: `Transfer(..., address(0), ...)` follows standard semantics
3. **Event-based reconstruction**: Reconstruction logic can rely on `Transfer` events alone,
   as `Transfer(..., address(0), ...)` unambiguously signals supply reduction

**Illegal Transitions**:
- Burning zero amount → `ZeroAmount` error
- Insufficient balance → `InsufficientBalance` error

## Illegal State Transitions

The following operations are **never legal** and will revert:

1. **Zero Address Operations**
   - Minting to `address(0)`
   - Transferring to `address(0)`

2. **Zero Amount Operations**
   - Minting 0 tokens
   - Transferring 0 tokens
   - Burning 0 tokens

3. **Insufficient Balance**
   - Transferring more than available balance
   - Burning more than available balance

4. **Invariant Violation**
   - Any operation that would cause `sum(balances) != totalSupply`
   - This is prevented by design, but should be verified in tests

## State Machine Diagram

```
Initial State:
  totalSupply = 0
  balances = {}

Valid Transitions:
  [Mint] → totalSupply += amount, balances[to] += amount
  [Transfer] → balances[from] -= amount, balances[to] += amount
  [Burn] → totalSupply -= amount, balances[from] -= amount

Illegal Transitions (Revert):
  Mint(zero, amount) → ZeroAddress
  Mint(to, 0) → ZeroAmount
  Transfer(zero, amount) → ZeroAddress
  Transfer(to, 0) → ZeroAmount
  Transfer(to, amount > balance) → InsufficientBalance
  Burn(0) → ZeroAmount
  Burn(amount > balance) → InsufficientBalance
```

## Verification

### On-Chain Verification: Not Possible

**Critical Limitation**: The invariant `sum(balances) == totalSupply` **cannot be verified on-chain** because:
- `mapping(address => Balance)` is not enumerable
- There is no way to iterate over all addresses that have balances
- Solidity does not provide a mechanism to enumerate mapping keys

**What We Can Verify On-Chain**:
- Individual `balanceOf(address)` queries
- `totalSupply()` value
- But NOT the sum of all balances

### Off-Chain Verification Methods

#### 1. Event-Based Reconstruction

The state can be reconstructed from events (off-chain):
1. Start with `totalSupply = 0`, `balances = {}`
2. Replay all `Mint` events: `balances[to] += amount`, `totalSupply += amount`
3. Replay all `Transfer` events:
   - If `to != address(0)`: `balances[from] -= amount`, `balances[to] += amount` (normal transfer)
   - If `to == address(0)`: `balances[from] -= amount`, `totalSupply -= amount` (burn via Transfer)
4. (Optional) Replay all `Burn` events: `balances[from] -= amount`, `totalSupply -= amount`
   - Note: `Burn` events are redundant if `Transfer(..., address(0), ...)` is already processed
5. Verify: `sum(balances) == totalSupply` (now possible because we have all balances)
6. Compare reconstructed `totalSupply` with on-chain `totalSupply()` to verify consistency

**Important**: The `Transfer(from, address(0), amount)` event is the canonical signal for supply reduction.
Reconstruction logic can rely solely on `Transfer` events, treating `Transfer(..., address(0), ...)` as burns.

**Limitation**: This requires knowing all addresses that have interacted with the contract.

#### 2. Testing-Based Verification

In tests, we can track all accounts and verify:
```solidity
uint256 sum = 0;
for (uint256 i = 0; i < knownAccounts.length; i++) {
    sum += token.balanceOf(knownAccounts[i]);
}
assertEq(sum, token.totalSupply());
```

**Limitation**: Only works for accounts we know about in tests.

#### 3. Guaranteed by Construction

The most important verification is **proof by construction**:
- Every state transition is designed to maintain the invariant
- Mint: `totalSupply += amount` and `balances[to] += amount` (same amount)
- Transfer: `totalSupply` unchanged, balances shift
- Burn: `totalSupply -= amount` and `balances[from] -= amount` (same amount)

If all transitions are correct, the invariant holds.

## Testing Strategy

1. **Unit Tests**: Test each transition in isolation
2. **Invariant Tests**: Verify `sum(balances) == totalSupply` for known accounts (off-chain only)
3. **Fuzz Tests**: Random operations to find edge cases
4. **Integration Tests**: Verify state reconstruction from events
5. **Formal Verification**: Prove mathematically that transitions preserve the invariant

**Important**: Invariant tests can only verify the invariant for accounts we track. The full invariant cannot be verified on-chain.

## Design Principles

1. **Deterministic**: Same inputs always produce same outputs
2. **Fail-Fast**: Illegal transitions revert immediately
3. **Inspectable**: All state changes emit events
4. **Minimal**: No unnecessary complexity (no approvals, no allowances)
5. **Correct**: Invariants are preserved by construction
