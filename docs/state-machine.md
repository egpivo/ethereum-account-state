# Token State Machine Specification

## Overview

This document defines the state machine for the Token contract, including state definitions, valid transitions, and invariants.

## State Definition

### Core State Variables

- `totalSupply: Balance` - Total supply of tokens (User-defined Value Type)
- `balances: mapping(address => Balance)` - Balance of each account (User-defined Value Type)

### Invariant

**Critical Invariant**: `sum(balances) == totalSupply` must hold at all times.

**Limitation**: This invariant **cannot be verified on-chain** because mappings are not enumerable. However, it is **guaranteed by construction** through state transitions:
- Mint: Both `totalSupply` and `balances[to]` increase by the same amount
- Transfer: `totalSupply` unchanged, balances shift between accounts
- Burn: Both `totalSupply` and `balances[from]` decrease by the same amount

**Verification Methods** (off-chain):
1. Event reconstruction: Replay events and verify `sum(balances) == totalSupply`
2. Testing: Track known accounts and verify the invariant
3. Formal verification: Prove mathematically that transitions preserve the invariant

## State Transitions

### 1. Mint

**Function**: `mint(address to, uint256 amount)`

**Authorization**: Public (anyone can call) - suitable for educational/testing. For production, add restrictions.

**Preconditions**: `to != address(0)`, `amount > 0`

**State Transition**:
```
totalSupply: S → S + amount
balances[to]: B → B + amount
```

**Events**: `Mint(to, amount)`

**Reverts**: `ZeroAddress`, `ZeroAmount`

### 2. Transfer

**Function**: `transfer(address to, uint256 amount)`

**Authorization**: Self-only (only `msg.sender` can transfer their own tokens)

**Preconditions**: `to != address(0)`, `amount > 0`, `balances[msg.sender] >= amount`

**State Transition**:
```
balances[from]: B_from → B_from - amount
balances[to]: B_to → B_to + amount
totalSupply: S → S (unchanged)
```

**Events**: `Transfer(from, to, amount)`

**Reverts**: `ZeroAddress`, `ZeroAmount`, `InsufficientBalance`

### 3. Burn

**Function**: `burn(uint256 amount)`

**Authorization**: Self-only (only `msg.sender` can burn their own tokens)

**Preconditions**: `amount > 0`, `balances[msg.sender] >= amount`

**State Transition**:
```
totalSupply: S → S - amount
balances[from]: B → B - amount
```

**Events**:
- `Burn(from, amount)` - Explicit burn event
- `Transfer(from, address(0), amount)` - ERC20 canonical supply reduction signal

**Event Semantics**: The `Transfer(..., address(0), ...)` event is the ERC20 standard way to signal token destruction. Event-based reconstruction can rely solely on `Transfer` events, treating `Transfer(..., address(0), ...)` as burns.

**Reverts**: `ZeroAmount`, `InsufficientBalance`

## Illegal State Transitions

The following operations revert:
1. Zero address operations (mint/transfer to `address(0)`)
2. Zero amount operations
3. Insufficient balance (transfer/burn)
4. Any operation that would violate `sum(balances) == totalSupply` (prevented by design)

## Design Principles

1. **Deterministic**: Same inputs always produce same outputs
2. **Fail-Fast**: Illegal transitions revert immediately
3. **Inspectable**: All state changes emit events
4. **Minimal**: No unnecessary complexity
5. **Correct**: Invariants preserved by construction
