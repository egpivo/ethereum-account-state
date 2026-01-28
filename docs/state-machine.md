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
1. Event reconstruction: Replay events and verify `sum(balances) == totalSupply` (educational/diagnostic)
   - **Boundary**: Not a verifier; can be incomplete without pagination, reorg handling, or storage-first reconciliation
2. Testing: Track known accounts and verify the invariant
3. Formal verification: Prove mathematically that transitions preserve the invariant

## State Transitions

### 1. Mint

**Function**: `mint(address to, uint256 amount)`

**Authorization**: **Intentionally permissionless** (anyone can call)
- This is a **design choice** for this minimal implementation, not a missing feature
- Suitable for educational/testing purposes where state machine correctness is the focus
- For production use, see [Authorization Model](./authorization-model.md) for extension patterns

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
- `Burn(from, amount)` - Explicit burn event (redundant with Transfer)
- `Transfer(from, address(0), amount)` - **Canonical burn signal** (ERC20 standard)

**Event Semantics for Reconstruction**:
- Both events are emitted for the same burn operation but have different logIndex values
- `Transfer(..., address(0), ...)` is the **canonical** burn signal (ERC20 standard, compatible with all ERC20 tooling)
- `Burn` events are redundant and only used as fallback if `Transfer(..., address(0), ...)` is missing
- **Critical for reconstruction**: Use `Transfer(..., address(0), ...)` as the canonical signal and skip `Burn` events from the same transaction
- **Batch burns**: If a transaction has multiple burns, all `Transfer(..., address(0), ...)` events are processed, all `Burn` events are skipped
- This design ensures consistency across event reconstruction, UI display, and standard ERC20 parsers

**Reverts**: `ZeroAmount`, `InsufficientBalance`

## Illegal State Transitions

The following operations revert:
1. Zero address operations (mint/transfer to `address(0)`)
2. Zero amount operations
3. Insufficient balance (transfer/burn)
4. Any operation that would violate `sum(balances) == totalSupply` (prevented by design)

## Off-Chain Model Consistency

**Critical Requirement**: Off-chain domain models (TypeScript `Token` entity) **must mirror** on-chain contract rules exactly.

### Validation Rules Alignment

| On-Chain (Solidity) | Off-Chain (TypeScript) | Consistency |
|---------------------|------------------------|-------------|
| `revert ZeroAddress` | `throw Error("Cannot ... to zero address")` | Matched |
| `revert ZeroAmount` | `throw Error("... amount must be greater than zero")` | Matched |
| `revert InsufficientBalance` | `throw Error("Insufficient balance ...")` | Matched |

### Why This Matters

- **Domain Validation**: Off-chain validation must catch the same errors as on-chain, preventing wasted gas
- **State Reconstruction**: Event-based reconstruction must apply the same rules to maintain consistency
- **Testing**: Off-chain models can be tested independently while guaranteeing on-chain compatibility
- **Reasoning**: Off-chain reasoning about state transitions must match on-chain behavior

### Implementation

The `Token` entity enforces these rules in `mint()`, `transfer()`, and `burn()` methods, ensuring that any direct call to these methods (bypassing `StateTransition` validation) still maintains consistency with on-chain behavior.

## Design Principles

1. **Deterministic**: Same inputs always produce same outputs
2. **Fail-Fast**: Illegal transitions revert immediately (on-chain) or throw errors (off-chain)
3. **Inspectable**: All state changes emit events
4. **Minimal**: No unnecessary complexity
5. **Correct**: Invariants preserved by construction
6. **Consistent**: Off-chain models mirror on-chain rules exactly
