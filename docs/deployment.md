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
   ```

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
# Set your private key
export PRIVATE_KEY=your_private_key_here

# Deploy to Sepolia
forge script contracts/script/DeploySepolia.s.sol:DeploySepolia \
    --rpc-url https://rpc.sepolia.dev \
    --broadcast \
    --verify \
    -vvv
```

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
- Optional: Contract works without verification
- For verification, set ETHERSCAN_API_KEY in .env

### Local Development

For local testing:

```bash
# Start Anvil
anvil

# Deploy to local network
npm run deploy:local
```
