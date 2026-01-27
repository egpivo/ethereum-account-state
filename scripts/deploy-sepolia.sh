#!/bin/bash

# Deploy Token contract to Sepolia testnet
# 
# Prerequisites:
# 1. Get test ETH from RubyScore Faucet: https://docs.rubyscore.io/
# 2. Set PRIVATE_KEY in .env file
# 3. Ensure you have enough ETH for gas

set -e

echo "🚀 Deploying Token contract to Sepolia testnet..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "📝 Please create .env file with PRIVATE_KEY"
    echo "   Example: PRIVATE_KEY=0x..."
    exit 1
fi

# Load environment variables
source .env

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env file"
    exit 1
fi

# Use Sepolia RPC (public endpoint, no API key needed)
RPC_URL="${SEPOLIA_RPC_URL:-https://rpc.sepolia.dev}"

echo "📡 Using RPC: $RPC_URL"
echo ""

# Deploy contract
forge script contracts/script/DeploySepolia.s.sol:DeploySepolia \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --verify \
    --etherscan-api-key "${ETHERSCAN_API_KEY:-}" \
    -vvv

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Copy the deployed contract address"
echo "   2. Add TOKEN_ADDRESS to your .env file"
echo "   3. Use the address in your frontend"
