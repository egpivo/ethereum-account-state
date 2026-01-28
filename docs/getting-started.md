# Getting Started

## Local (Anvil)

### 1) Start Anvil

```bash
anvil
```

Anvil runs at `http://127.0.0.1:8545` with chainId `31337`.

### 2) Deploy the contract

```bash
make deploy-local
```

This prints the deployed contract address (you will paste it into the UI).

### 3) Add “Anvil Local” to MetaMask

MetaMask does not add local networks from the “Supported Networks” list.

- **Network Name**: `Anvil Local`
- **New RPC URL**: `http://127.0.0.1:8545`
- **Chain ID**: `31337`
- **Currency Symbol**: `ETH`
- **Block Explorer URL**: (leave empty)

### 4) Import an Anvil test account into MetaMask

Anvil prints 10 funded accounts + private keys on startup. Import one of them:

MetaMask → **Import account** → **Private Key** → paste (example: account 0):

```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

Never use these keys on mainnet.

### 5) Run the frontend

```bash
cd frontend
npm install
npm run dev
```

### 6) Use the UI

1. Click **Connect Wallet**
2. Paste the deployed **Token Contract** address
3. Click **Load**
4. New deployments start at `totalSupply = 0`. Use **Mint** once to create tokens.

## Sepolia

```bash
cp .env.example .env
# set PRIVATE_KEY=...
npm run deploy:sepolia
cd frontend && npm install && npm run dev
```

