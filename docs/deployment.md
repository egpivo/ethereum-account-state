# Deployment Guide

## Sepolia Testnet Deployment

### Prerequisites

1. **Get Test ETH**:
   - Visit [RubyScore Faucet](https://docs.rubyscore.io/)
   - Request Sepolia test ETH (free, limited amount)
   - Wait for confirmation

2. **Set Up Environment**:

   ```bash
   cp .env.example .env
   # Edit .env and add your PRIVATE_KEY
   # Format: PRIVATE_KEY=0x... (do NOT use 'export' in .env file)
   # Optional: Add ETHERSCAN_API_KEY if you want contract verification
   ```

   **Important**: The `.env` file should use format `PRIVATE_KEY=0x...` (without `export`). The deployment script automatically exports variables using `set -a`.

3. **Verify Balance**:
   - Check your wallet has Sepolia ETH for gas fees
   - Minimum recommended: 0.01 ETH

### Deployment Steps

#### Option 1: Using Script (Recommended)

```bash
npm run deploy:sepolia
```

#### Option 2: Manual Deployment

```bash
# Export private key (required for vm.envUint() in script)
export PRIVATE_KEY=your_private_key_here

# Optional: Set RPC URL
export SEPOLIA_RPC_URL=https://rpc.sepolia.dev

# Optional: Set Etherscan API key for contract verification
export ETHERSCAN_API_KEY=your_api_key_here

# Deploy to Sepolia
# Note: --verify flag is only added if ETHERSCAN_API_KEY is set
forge script contracts/script/DeploySepolia.s.sol:DeploySepolia \
    --rpc-url https://rpc.sepolia.dev \
    --broadcast \
    ${ETHERSCAN_API_KEY:+--verify --etherscan-api-key "$ETHERSCAN_API_KEY"} \
    -vvv
```

**Important Notes**:

- **Environment Variables**: When using the script (`deploy-sepolia.sh`), variables in `.env` are automatically exported. For manual deployment, you must use `export` commands.
- **Contract Verification**: `--verify` is **optional** and **disabled by default**. It only runs if `ETHERSCAN_API_KEY` is set. Deployment works perfectly without verification.
- **`.env` File Format**: Use `PRIVATE_KEY=0x...` (without `export`) in `.env` file. The script handles exporting automatically.

### Configuration

**RPC Endpoint**: `https://rpc.sepolia.dev` (public, no API key needed)

**Network Details**:

- Chain ID: 11155111
- Block Explorer: https://sepolia.etherscan.io
- PoS (Proof of Stake) - no mining needed

### After Deployment

1. **Save Contract Address**:

   ```bash
   # Add to .env
   TOKEN_ADDRESS=0x...
   ```

2. **Verify on Etherscan**:
   - Visit https://sepolia.etherscan.io
   - Search for your contract address
   - Verify contract (if using --verify flag)

3. **Use in Frontend**:
   - Update frontend with deployed contract address
   - Connect MetaMask to Sepolia network
   - Start interacting with the contract

### Troubleshooting

**Insufficient Gas**:

- Get more test ETH from faucet
- Check gas price on Sepolia

**Deployment Fails**:

- Verify PRIVATE_KEY is correct
- Check RPC endpoint is accessible
- Ensure contract compiles: `forge build`

**Verification Fails**:

- Contract works perfectly without verification
- Verification is optional and only runs if `ETHERSCAN_API_KEY` is set
- To enable verification: add `ETHERSCAN_API_KEY=your_key` to `.env` file
- Get API key from: https://etherscan.io/apis

### Local Development

For local testing:

```bash
# Start Anvil
anvil

# Deploy to local network
npm run deploy:local
```
