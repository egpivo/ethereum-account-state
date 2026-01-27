# Frontend - Token Wallet Interface

A React + Vite frontend for interacting with the Token contract.

## Features

- Connect MetaMask wallet
- View token balance and total supply
- Transfer tokens
- Mint tokens (if authorized)
- Burn tokens
- View recent events (Mint, Transfer, Burn)

## Setup

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

The app will open at `http://localhost:3000`

## Build

```bash
npm run build
```

## Usage

1. **Connect Wallet**: Click "Connect Wallet" to connect your MetaMask
2. **Set Token Address**: Enter the deployed Token contract address
3. **Load Balance**: Click "Load" to fetch your balance and total supply
4. **Transfer**: Enter recipient address and amount, then click "Transfer"
5. **Mint**: Enter recipient address and amount, then click "Mint" (if authorized)
6. **Burn**: Enter amount and click "Burn" to destroy your tokens
7. **View Events**: Recent events are displayed automatically

## Requirements

- MetaMask browser extension
- Token contract deployed to the network
- Network configured in MetaMask (local Anvil, testnet, or mainnet)
