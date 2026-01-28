# Ethereum Account State

[![CI](https://github.com/egpivo/ethereum-account-state/actions/workflows/ci.yml/badge.svg)](https://github.com/egpivo/ethereum-account-state/actions/workflows/ci.yml)

Minimal token + wallet UI built around a deterministic, inspectable state machine.

![Architecture & Execution Flow](docs/arch.png)

## Quickstart

### Local (Anvil)

```bash
npm install
anvil
```

```bash
npm run deploy:local
cd frontend && npm install && npm run dev
```

- MetaMask: `http://localhost:8545` (chainId 31337)

### Sepolia

```bash
cp .env.example .env
# set PRIVATE_KEY=...
npm run deploy:sepolia
cd frontend && npm install && npm run dev
```

## Commands

```bash
npm run build
npm test
npm run lint
```

## Docs

- `docs/local-development.md` - Connet MetaMask to the local Anvil node
- `docs/state-machine.md`
- `docs/execution-flow.md`
- `docs/authorization-model.md`
- `docs/deployment.md`
- `docs/advanced-features.md`
- `docs/future-work.md`

## GitHub Pages

- Workflow: `.github/workflows/pages-frontend.yml`
- URL: `https://egpivo.github.io/ethereum-account-state/`
