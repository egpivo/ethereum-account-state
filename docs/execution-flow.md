# Execution Flow

## Overview

This document describes the execution flow of the token and wallet system, from transaction creation to state verification.

## Execution Flows

### Token Transfer

```
User Request
    ↓
WalletService.transfer()
    ↓
[Domain Validation] StateTransition.validateTransfer()
    ↓
[Signing] WalletService.signTransaction()
    ↓
[Sending] WalletService.sendTransaction()
    ↓
[On-Chain] Token.transfer() executes
    ↓
[State Change] balances[from] -= amount, balances[to] += amount
    ↓
[Event] Transfer(from, to, amount) emitted
    ↓
[Receipt] Transaction receipt returned
    ↓
[Inspection] WalletService.inspectReceipt()
```

**Error Handling**:
- Domain validation fails → Return error before transaction (no gas spent)
- Transaction reverts → Receipt contains revert reason (gas spent)
- Network failure → Exception thrown

**Critical**: Domain validation rules (`StateTransition.validate*()`) and entity rules (`Token.mint/transfer/burn()`) **must mirror** on-chain contract rules exactly. This ensures:
- Off-chain validation catches the same errors as on-chain (preventing wasted gas)
- State reconstruction applies the same rules (maintaining consistency)
- Off-chain reasoning matches on-chain behavior (preventing model inconsistencies)

### State Query (Storage Read)

```
User Request
    ↓
StateQueryService.getTokenBalance()
    ↓
[RPC] eth_call to Token.balanceOf()
    ↓
[On-Chain] Read balances[account] from storage
    ↓
[Response] Balance value returned
```

### State Reconstruction (Event-Based)

```
User Request
    ↓
StateQueryService.reconstructStateFromEvents()
    ↓
[RPC] eth_getLogs for Mint/Transfer/Burn events
    ↓
[Replay] Apply events in order:
    - Mint → balances[to] += amount, totalSupply += amount
    - Transfer(to != 0) → balances[from] -= amount, balances[to] += amount
    - Transfer(to == 0) → balances[from] -= amount, totalSupply -= amount (burn)
    - Burn → Skip if Transfer(..., address(0), ...) from same tx already processed
    ↓
[Result] Reconstructed Token entity
```

**Critical**: The contract emits both `Burn` and `Transfer(..., address(0), ...)` for burns. To prevent double-counting, reconstruction uses `Transfer(..., address(0), ...)` as the **canonical signal** (ERC20 standard) and skips `Burn` events from the same transaction.

**Canonical Event Source**:
- `Transfer(..., address(0), ...)` is the canonical burn signal (ERC20 standard, compatible with all ERC20 tooling)
- `Burn` events are redundant and only used as a fallback if `Transfer(..., address(0), ...)` is missing
- For batch burns: All `Transfer(..., address(0), ...)` events are processed, all `Burn` events are skipped
- This design ensures consistency across event reconstruction, UI display, and standard ERC20 parsers

**Important Boundary**: Event-based reconstruction is used as an **educational and diagnostic technique**. It is **not a verifier** and can be incomplete without:
- Pagination (for large event histories)
- Reorg handling (for chain reorganizations)
- Storage-first reconciliation (for production accuracy)

This implementation demonstrates the concept but should not be relied upon as the sole source of truth in production systems.

## Separation of Concerns

### Wallet ≠ State ≠ Authority

**Important**: This separation is a **conceptual model** for understanding the system architecture, not an enforced on-chain property in this minimal implementation.

**Wallet** (`WalletService`):
- Owns private key, signs transactions, submits to network
- Does NOT manage state

**State** (`Token` contract):
- Maintains balances, enforces rules, emits events
- Does NOT know about wallets

**Authority** (Conceptual):
- In this minimal implementation: **Minting is intentionally permissionless**
- Authority separation is presented as a conceptual model for understanding system design
- For production use, authority would be enforced on-chain (see [Authorization Model](../docs/authorization-model.md))
- In production: Determined by private key ownership, verified by ECDSA signature, enforced by EVM (msg.sender) and access control

## Transaction Lifecycle

1. **Preparation**: Domain validation (off-chain)
2. **Signing**: Create and sign transaction (doesn't send)
3. **Submission**: Send transaction to network
4. **Execution**: Contract executes on-chain (validation, state transition, events)
5. **Verification**: Inspect receipt and verify state change

## Error Handling

- **Domain Errors**: Caught before transaction (no gas spent)
- **Transaction Reverts**: Caught in receipt (gas spent)
- **Network Errors**: Connection failures, timeouts
