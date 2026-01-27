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
- Domain validation fails → Return error before transaction
- Transaction reverts → Receipt contains revert reason
- Network failure → Exception thrown

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

**Critical**: The contract emits both `Burn` and `Transfer(..., address(0), ...)` for burns. To prevent double-counting, reconstruction uses `Transfer(..., address(0), ...)` as the canonical signal and skips `Burn` events from the same transaction.

## Separation of Concerns

### Wallet ≠ State ≠ Authority

**Wallet** (`WalletService`):
- Owns private key, signs transactions, submits to network
- Does NOT manage state

**State** (`Token` contract):
- Maintains balances, enforces rules, emits events
- Does NOT know about wallets

**Authority**:
- Determined by private key ownership
- Verified by ECDSA signature
- Enforced by EVM (msg.sender)

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
