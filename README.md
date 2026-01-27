# Ethereum Account State

A Domain-Driven Design (DDD) implementation of an Ethereum token and wallet system, focusing on state machine correctness, clear separation of concerns, and comprehensive testing.

## Project Philosophy

This project demonstrates:

- **State Machine Design**: Token contract as a deterministic state machine with explicit invariants
- **DDD Architecture**: Clear separation between Domain, Application, and Infrastructure layers
- **Correctness First**: Comprehensive testing including invariant tests and fuzz testing
- **Explainability**: Detailed documentation of state transitions and execution flows

## Project Structure

```
ethereum-account-state/
├── contracts/              # Smart Contract Layer
│   ├── src/
│   │   └── Token.sol      # Core state machine contract
│   └── test/
│       ├── Token.t.sol    # Unit tests
│       └── Invariant.t.sol # Invariant tests
├── domain/                 # Domain Layer (DDD Core)
│   ├── entities/          # Aggregate roots and entities
│   ├── value-objects/     # Value objects
│   ├── services/          # Domain services
│   └── repositories/      # Repository interfaces
├── application/           # Application Layer
│   └── services/          # Application services
├── infrastructure/        # Infrastructure Layer
│   └── ethereum/          # Ethereum provider implementations
├── tests/                 # TypeScript tests
│   └── unit/              # Domain layer unit tests
└── docs/                  # Documentation
    ├── state-machine.md   # State machine specification
    └── execution-flow.md   # Execution flow documentation
```

## Architecture Layers

### 1. Smart Contract Layer (State Machine Core)

**Purpose**: Define account state, legal state transitions, and failure boundaries.

- **Language**: Solidity ^0.8.24
- **Tooling**: Foundry (forge / anvil)
- **Key Features**:
  - Custom ledger-style token (minimal, inspectable)
  - Explicit invariants (e.g., `sum(balances) == totalSupply`)
  - Custom errors for debuggability
  - Events as canonical history

**Core Invariant (Theoretical)**: `sum(balances) == totalSupply` must hold at all times.

**Important**: This invariant cannot be directly verified on-chain because mappings are not enumerable. However, it is guaranteed by construction through state transitions. See [State Machine Specification](./docs/state-machine.md) for verification methods.

### 2. Domain Layer (Business Logic)

**Purpose**: Encapsulate business rules and domain concepts.

- **Entities**: `Account`, `Token`
- **Value Objects**: `Address`, `Balance`
- **Services**: `StateTransition` (validation)

### 3. Application Layer (Use Cases)

**Purpose**: Orchestrate domain objects to fulfill use cases.

- **WalletService**: Wallet operations (signing, sending transactions)
- **StateQueryService**: State querying (storage reads, event reconstruction)

**Key Separation**: Wallet ≠ State ≠ Authority

### 4. Infrastructure Layer (External Dependencies)

**Purpose**: Provide implementations for external systems.

- **EthereumProvider**: RPC provider factory
- **ContractRepository**: On-chain state repository

## Getting Started

### Prerequisites

- Node.js 18+
- Foundry (for Solidity development)
- Anvil (local EVM, comes with Foundry)

### Installation

```bash
# Install Node.js dependencies
npm install

# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Build

```bash
# Compile Solidity contracts
forge build

# Compile TypeScript
npm run build
```

### Test

```bash
# Run Foundry tests (Solidity)
forge test

# Run TypeScript unit tests
npm run test:unit

# Run all tests
npm test
```

### Local Development

```bash
# Start local Anvil node
anvil

# In another terminal, deploy to local node
npm run deploy:local
```

## Documentation

- **[State Machine Specification](./docs/state-machine.md)**: Detailed specification of token state machine, transitions, and invariants
- **[Authorization Model](./docs/authorization-model.md)**: Complete authorization model - who can perform which operations
- **[Execution Flow](./docs/execution-flow.md)**: Documentation of execution flows, architecture layers, and transaction lifecycle
- **[Invariant Verification](./docs/invariant-verification.md)**: Critical discussion of on-chain verification limitations and off-chain verification methods
- **[Advanced Features](./docs/advanced-features.md)**: Solidity 0.8.28 advanced features (User-defined Value Types, Transient Storage, Using Directives)

## Testing Strategy

### Unit Tests

- Test each state transition in isolation
- Verify revert conditions
- Test edge cases (zero balance, exact balance, etc.)

### Invariant Tests

- Verify `sum(balances) == totalSupply` for known accounts (off-chain verification)
- Use Foundry's invariant testing framework
- Fuzz testing with random operations

### Integration Tests

- Test with local blockchain (anvil)
- Verify on-chain execution
- Check state reconstruction from events

## Key Concepts

### State Machine

The token contract is designed as a deterministic state machine:

- **Initial State**: `totalSupply = 0`, all `balances = 0`
- **Valid Transitions**:
  - `Mint`: `totalSupply += amount`, `balances[to] += amount`
  - `Transfer`: `balances[from] -= amount`, `balances[to] += amount`
  - `Burn`: `totalSupply -= amount`, `balances[from] -= amount`
- **Illegal Transitions**: Revert with custom errors

### Separation of Concerns

- **Wallet**: Owns private key, signs transactions, submits to network
- **State**: Maintained by smart contract, enforced by EVM
- **Authority**: Determined by private key ownership, verified by signature

### State Query Methods

1. **Storage Reads**: Direct `eth_call` to contract functions
2. **Event Reconstruction**: Replay events to rebuild state
3. **Verification**: Compare storage state vs derived state

## Tech Stack

- **Solidity**: ^0.8.28 (with advanced features)
- **Foundry**: Testing and deployment
- **TypeScript**: Application layer
- **ethers.js**: Ethereum interaction
- **Node.js**: Runtime environment

### Advanced Solidity Features (2026 Edition)

- **User-defined Value Types**: Type-safe `Balance` to prevent logic errors
- **Transient Storage (EIP-1153)**: Gas-efficient reentrancy protection using `tstore`/`tload` (200x cheaper than regular storage)
- **Using Directives**: Financial-grade arithmetic operations

See [Advanced Features Documentation](./docs/advanced-features.md) for details.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Learning Outcomes

This project demonstrates:

1. **State Machine Design**: How to design and verify deterministic state machines
2. **DDD Principles**: Domain-driven design in a blockchain context
3. **Testing Strategies**: Unit tests, invariant tests, fuzz testing
4. **Ethereum Concepts**: Account-based state, state transitions, events, RPC calls
5. **Correctness**: How to prove system correctness through invariants

## Future Extensions

- Rust-based event ingestion
- Balance reconstruction at scale
- Transaction diagnostics
- Failure pattern analysis
- State evolution over time

---

**Note**: This is an educational project focusing on correctness, explainability, and engineering best practices rather than production-ready features.
