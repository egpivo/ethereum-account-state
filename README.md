# Ethereum Account State

[![CI](https://github.com/egpivo/ethereum-account-state/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/ethereum-account-state/actions/workflows/ci.yml)

Minimal token + wallet UI built around a deterministic, inspectable state machine.

## Quickstart

### Local (Anvil)

```bash
npm install
anvil
```

In another terminal:

```bash
npm run deploy:local
cd frontend && npm install && npm run dev
```

- MetaMask network: `http://localhost:8545` (chainId 31337)
- Paste the deployed contract address into the frontend UI

### Sepolia

```bash
cp .env.example .env
# set PRIVATE_KEY=...
npm run deploy:sepolia
cd frontend && npm install && npm run dev
```

## Repo Layout

```
contracts/        Solidity (Foundry)
domain/           DDD domain model (Token, Address, Balance)
application/      WalletService, StateQueryService
infrastructure/   RPC provider + repository (best-effort)
frontend/         React + ethers.js UI
tests/            TypeScript unit tests
docs/             Specs and write-ups
```

## Commands

```bash
npm run build
npm test
npm run lint
```

## Notes

- **No backend server**: the frontend talks to the chain directly (MetaMask / RPC).
- **Mint is intentionally permissionless** in this minimal implementation. See `docs/authorization-model.md` for extension patterns.
- **Invariant**: \( \sum balances == totalSupply \) is theoretical (mappings are not enumerable on-chain). It is guaranteed by construction and validated via tests/off-chain techniques.
- **Event reconstruction**: correct with complete history (validated by tests); best-effort diagnostic if history is incomplete (pagination/reorgs). See `docs/execution-flow.md`.

## Docs

- `docs/state-machine.md`
- `docs/execution-flow.md`
- `docs/authorization-model.md`
- `docs/deployment.md`
- `docs/advanced-features.md`
- `docs/future-work.md`
