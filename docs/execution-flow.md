# Execution Flow Documentation

## Overview

This document describes the execution flow of the token and wallet system, from transaction creation to state verification.

## Architecture Layers

### 1. Smart Contract Layer (State Machine Core)

**Purpose**: Define account state, legal state transitions, and failure boundaries.

**Components**:
- `Token.sol` - Core state machine contract

**Responsibilities**:
- Maintain token state (`totalSupply`, `balances`)
- Enforce state transition rules
- Revert on illegal transitions
- Emit events for all state changes

**Key Characteristics**:
- Deterministic state transitions
- Custom errors for debuggability
- Events as canonical history

### 2. Domain Layer (Business Logic)

**Purpose**: Encapsulate business rules and domain concepts.

**Components**:
- `Address` - Value object for Ethereum addresses
- `Balance` - Value object for token balances
- `Account` - Entity representing an account
- `Token` - Entity representing token state
- `StateTransition` - Domain service for transition validation

**Responsibilities**:
- Define domain concepts
- Enforce business rules
- Validate state transitions (before execution)

### 3. Application Layer (Use Cases)

**Purpose**: Orchestrate domain objects to fulfill use cases.

**Components**:
- `WalletService` - Wallet operations (signing, sending)
- `StateQueryService` - State querying operations

**Responsibilities**:
- Coordinate wallet operations
- Query on-chain state
- Reconstruct state from events
- Compare storage vs derived state

### 4. Infrastructure Layer (External Dependencies)

**Purpose**: Provide implementations for external systems.

**Components**:
- `EthereumProvider` - Ethereum RPC provider factory
- `ContractRepository` - On-chain state repository

**Responsibilities**:
- Connect to Ethereum networks
- Implement repository interfaces
- Handle RPC communication

## Execution Flows

### Flow 1: Token Transfer

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

### Flow 2: State Query (Storage Read)

```
User Request
    ↓
StateQueryService.getTokenBalance()
    ↓
[Infrastructure] EthereumProvider.call()
    ↓
[RPC] eth_call to Token.balanceOf()
    ↓
[On-Chain] Read balances[account] from storage
    ↓
[Response] Balance value returned
```

### Flow 3: State Reconstruction (Event-Based)

```
User Request
    ↓
StateQueryService.reconstructStateFromEvents()
    ↓
[Infrastructure] EthereumProvider.getLogs()
    ↓
[RPC] eth_getLogs for Mint/Transfer/Burn events
    ↓
[Replay] Apply events in order:
    - Mint → balances[to] += amount, totalSupply += amount
    - Transfer → balances[from] -= amount, balances[to] += amount
    - Burn → balances[from] -= amount, totalSupply -= amount
    ↓
[Result] Reconstructed Token entity
```

### Flow 4: State Verification

```
User Request
    ↓
StateQueryService.compareState()
    ↓
[Parallel]
    ├─→ getTokenBalance() → Storage state
    └─→ reconstructStateFromEvents() → Derived state
    ↓
[Compare] storageBalance vs derivedBalance
    ↓
[Result] Match status returned
```

## Separation of Concerns

### Wallet ≠ State ≠ Authority

**Wallet** (`WalletService`):
- Owns private key
- Signs transactions
- Submits transactions
- Does NOT manage state

**State** (`Token` contract):
- Maintains balances
- Enforces rules
- Emits events
- Does NOT know about wallets

**Authority**:
- Determined by private key ownership
- Verified by ECDSA signature
- Enforced by EVM (msg.sender)

## Transaction Lifecycle

### 1. Preparation Phase

```typescript
// Domain validation (off-chain)
const validation = StateTransition.validateTransfer(
  token,
  from,
  to,
  amount
);

if (!validation.valid) {
  throw new Error(validation.reason);
}
```

### 2. Signing Phase

```typescript
// Create transaction data
const data = tokenInterface.encodeFunctionData("transfer", [
  to,
  amount
]);

// Sign transaction (doesn't send yet)
const signedTx = await walletService.signTransaction(
  tokenAddress,
  data
);
```

### 3. Submission Phase

```typescript
// Send transaction to network
const receipt = await walletService.sendTransaction(
  tokenAddress,
  data
);
```

### 4. Execution Phase (On-Chain)

```solidity
// Contract executes
function transfer(address to, uint256 amount) external {
    // Validation
    if (to == address(0)) revert ZeroAddress();
    if (amount == 0) revert ZeroAmount();
    
    uint256 fromBalance = balances[msg.sender];
    if (fromBalance < amount) {
        revert InsufficientBalance(...);
    }
    
    // State transition
    balances[msg.sender] -= amount;
    balances[to] += amount;
    
    // Event
    emit Transfer(msg.sender, to, amount);
}
```

### 5. Verification Phase

```typescript
// Inspect receipt
const inspection = WalletService.inspectReceipt(receipt);

if (!inspection.success) {
  console.error("Transaction failed:", inspection.error);
}

// Verify state change
const newBalance = await stateQueryService.getTokenBalance(
  tokenAddress,
  accountAddress
);
```

## Error Handling

### Domain Errors (Pre-Transaction)

- Caught before transaction creation
- No gas spent
- Immediate feedback

### Transaction Reverts (On-Chain)

- Caught in transaction receipt
- Gas spent on execution
- Revert reason available

### Network Errors

- Connection failures
- Timeout errors
- Retry logic needed

## Testing Strategy

### Unit Tests

- Test domain logic in isolation
- No blockchain interaction
- Fast execution

### Integration Tests

- Test with local blockchain (anvil)
- Verify on-chain execution
- Check state changes

### Invariant Tests

- Verify `sum(balances) == totalSupply` for known accounts (off-chain verification)
- **Important**: Cannot verify on-chain because mappings are not enumerable
- Fuzz testing with random operations
- Property-based testing
- The invariant is guaranteed by construction through state transitions

## Key Insights

1. **State is On-Chain**: The source of truth is the smart contract, not application code
2. **Events are History**: Events provide a complete audit trail
3. **Validation is Layered**: Domain validation (off-chain) + Contract validation (on-chain)
4. **Separation is Critical**: Wallet, state, and authority are distinct concepts
5. **Verification is Essential**: Always verify state after operations
