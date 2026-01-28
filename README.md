# Ethereum Account State

[![CI](https://github.com/joseph/ethereum-account-state/actions/workflows/ci.yml/badge.svg)](https://github.com/joseph/ethereum-account-state/actions/workflows/ci.yml)

Minimal Ethereum token system designed as a deterministic state machine, with explicit transitions, off-chain reasoning, and comprehensive tests.

## Project Philosophy

- **State Machine First**: Explicit transitions and illegal operations
- **Execution Boundaries**: Wallet vs state vs authority (authority is conceptual)
- **Correctness-Oriented**: Invariants, unit tests, fuzzing
- **Explainable**: Clear state transition and execution flow docs

## Project Structure

```
ethereum-account-state/
├── contracts/          # Solidity contracts (Foundry)
│   ├── src/Token.sol  # Core token contract
│   └── test/          # Foundry tests
├── domain/            # Domain layer (entities, value objects, services)
├── application/       # Application services (WalletService, StateQueryService)
├── infrastructure/    # Infrastructure (Ethereum providers, repositories)
├── frontend/          # React frontend (wallet UI)
├── tests/             # TypeScript unit tests
└── docs/              # Documentation
```

**Key Files**:

- `contracts/src/Token.sol` - Smart contract (state machine)
- `application/services/WalletService.ts` - Wallet operations
- `application/services/StateQueryService.ts` - State querying & event reconstruction
- `domain/entities/Token.ts` - Domain entity (used in reconstruction)
- `frontend/src/App.tsx` - Web UI

## Architecture Layers

### 1. Smart Contract Layer (State Machine Core)

**Purpose**: Define account state, legal transitions, and failure boundaries.

- **Language**: Solidity ^0.8.28
- **Tooling**: Foundry (forge / anvil)
- **Key Features**:
  - Minimal ledger-style token
  - Explicit invariants (e.g., `sum(balances) == totalSupply`)
  - Custom errors
  - Events as canonical history

**Core Invariant (Theoretical)**: `sum(balances) == totalSupply` must hold at all times.

**Important**: This invariant cannot be directly verified on-chain because mappings are not enumerable. It is guaranteed by construction through state transitions. See [State Machine Specification](./docs/state-machine.md) for verification methods.

### 2. Domain Layer (Business Logic)

**Purpose**: Encapsulate business rules for off-chain reasoning.

- **Entities**: `Token` (used in state reconstruction)
- **Value Objects**: `Address`, `Balance`
- **Services**: `StateTransition` (validation, used by `WalletService`)

**Note**: Some domain entities (e.g., `Account`) are defined but not actively used. See [Future Work](./docs/future-work.md).

### 3. Application Layer (Use Cases)

**Purpose**: Orchestrate use cases with domain validation.

- **WalletService**: Wallet operations with domain validation
- **StateQueryService**: Storage reads and event-based reconstruction

**Key Separation**: Wallet ≠ State ≠ Authority

**Important Design Note**:

- **Minting is intentionally permissionless** in this minimal implementation
- **Authority separation** is a conceptual model, not an enforced on-chain property
- For production use, see [Authorization Model](./docs/authorization-model.md)

**Domain Integration**:

- `WalletService` uses `StateTransition` for pre-transaction validation
- `StateQueryService` uses `Token` for reconstruction and invariant checks

### 4. Infrastructure Layer (External Dependencies)

**Purpose**: Provide external integrations.

- **EthereumProvider**: RPC provider factory
- **ContractRepository**: On-chain state repository
  - **Design Choice**: Best-effort diagnostic mode (not fail-fast)
  - Storage vs reconstruction mismatches are logged but tolerated
  - Suitable for educational/diagnostic use where reconstruction may be incomplete

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

**Important**: This project uses a **frontend-only architecture**. The frontend connects directly to the blockchain (via MetaMask or RPC provider). There is no separate backend server.

**Development Flow**:

1. **Start local blockchain** (Anvil):

   ```bash
   anvil
   ```

   This starts a local Ethereum node at `http://localhost:8545`

2. **Deploy contract to local node** (in another terminal):

   ```bash
   npm run deploy:local
   ```

   Copy the deployed contract address from the output.

3. **Start frontend** (in another terminal):

   ```bash
   cd frontend
   npm install  # First time only
   npm run dev
   ```

   The frontend will open at `http://localhost:3000`

4. **Connect to local network**:
   - Open MetaMask
   - Add network: `http://localhost:8545` (Chain ID: 31337)
   - Use the contract address from step 2
   - Connect wallet in the frontend

**Alternative: Use Testnet** (no local node needed):

- Deploy to Sepolia testnet (see below)
- Start frontend: `cd frontend && npm run dev`
- Connect MetaMask to Sepolia network

### Deploy to Sepolia Testnet

**For testnet development** (no local node needed):

1. **Get test ETH**: Visit [RubyScore Faucet](https://docs.rubyscore.io/) to get Sepolia test ETH

2. **Deploy contract**:

   ```bash
   # Set PRIVATE_KEY in .env file
   npm run deploy:sepolia
   ```

   Copy the deployed contract address from the output.

3. **Start frontend**:

   ```bash
   cd frontend
   npm install  # First time only
   npm run dev
   ```

4. **Connect to Sepolia**:
   - Connect MetaMask to Sepolia network
   - Use the contract address from step 2
   - Connect wallet in the frontend

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

This keeps off-chain reasoning aligned with on-chain behavior.

### Separation of Concerns

- **Wallet**: Owns private key, signs transactions, submits to network
- **State**: Maintained by smart contract, enforced by EVM
- **Authority**: Determined by private key ownership, verified by signature

### State Query Methods

1. **Storage Reads**: Direct `eth_call` to contract functions (production-ready)
2. **Event Reconstruction**: Replay events to rebuild state
   - **Correctness**: Validated by tests in ideal conditions (complete history)
   - **Boundary**: Best-effort diagnostic when history is incomplete (pagination, reorgs)
3. **Comparison**: Compare storage state vs derived state (diagnostic)

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
