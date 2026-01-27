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

- **Language**: Solidity ^0.8.28
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

- **Entities**: `Token` (used in state reconstruction)
- **Value Objects**: `Address`, `Balance` (used throughout)
- **Services**: `StateTransition` (validation, used by `WalletService`)

**Note**: Some domain entities (e.g., `Account`) are defined but not actively used in current implementation. See [Future Work](./docs/future-work.md) for details.

### 3. Application Layer (Use Cases)

**Purpose**: Orchestrate domain objects to fulfill use cases.

- **WalletService**: Wallet operations with domain validation (uses `StateTransition` for pre-transaction validation)
- **StateQueryService**: State querying using domain entities (uses `Token` entity for event-based reconstruction)

**Key Separation**: Wallet ≠ State ≠ Authority

**Important Design Note**: 
- **Minting is intentionally permissionless** in this minimal implementation
- **Authority separation** (wallet ≠ state ≠ authority) is presented as a **conceptual model**, not an enforced on-chain property
- This is a design choice for educational/testing purposes, not a missing feature
- For production use, see [Authorization Model](./docs/authorization-model.md) for extension patterns

**Domain Integration**: Application services actively use domain entities and services:
- `WalletService` uses `StateTransition` validation to prevent invalid transactions
- `StateQueryService` uses `Token` entity for state reconstruction and invariant verification

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

### Deploy to Sepolia Testnet

```bash
# 1. Get test ETH from RubyScore Faucet: https://docs.rubyscore.io/
# 2. Set PRIVATE_KEY in .env file
# 3. Deploy to Sepolia
npm run deploy:sepolia
```

See [Deployment Guide](./docs/deployment.md) for detailed instructions.

## Documentation

- **[State Machine Specification](./docs/state-machine.md)**: Token state machine, transitions, invariants, and verification methods
- **[Authorization Model](./docs/authorization-model.md)**: Who can perform which operations and extension patterns
- **[Execution Flow](./docs/execution-flow.md)**: Transaction lifecycle and state query flows
- **[Advanced Features](./docs/advanced-features.md)**: Solidity 0.8.28 features (User-defined Value Types, Using Directives)
- **[Future Work](./docs/future-work.md)**: Exploratory features and unused patterns (Account entity, etc.)

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

**Critical Consistency Requirement**: Off-chain domain models (TypeScript `Token` entity) **must mirror** on-chain contract rules exactly:
- Zero address operations → Revert (on-chain) / Throw error (off-chain)
- Zero amount operations → Revert `ZeroAmount` (on-chain) / Throw error (off-chain)
- Insufficient balance → Revert `InsufficientBalance` (on-chain) / Throw error (off-chain)

This ensures that off-chain reasoning (domain validation, state reconstruction) matches on-chain behavior, preventing model inconsistencies.

### Separation of Concerns

- **Wallet**: Owns private key, signs transactions, submits to network
- **State**: Maintained by smart contract, enforced by EVM
- **Authority**: Determined by private key ownership, verified by signature

### State Query Methods

1. **Storage Reads**: Direct `eth_call` to contract functions (production-ready)
2. **Event Reconstruction**: Replay events to rebuild state (educational/diagnostic)
   - **Boundary**: Not a verifier; can be incomplete without pagination, reorg handling, or storage-first reconciliation
3. **Comparison**: Compare storage state vs derived state (for diagnostic purposes)

## Tech Stack

- **Solidity**: ^0.8.28 (with advanced features)
- **Foundry**: Testing and deployment
- **TypeScript**: Application layer
- **ethers.js**: Ethereum interaction
- **Node.js**: Runtime environment

### Advanced Solidity Features (2026 Edition)

- **User-defined Value Types**: Type-safe `Balance` to prevent logic errors
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
