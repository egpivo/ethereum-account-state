#!/bin/bash

# Deploy Token contract to Sepolia testnet
# 
# Prerequisites:
# 1. Get test ETH from RubyScore Faucet: https://docs.rubyscore.io/
# 2. Set PRIVATE_KEY in .env file
# 3. Ensure you have enough ETH for gas

set -e

echo "Deploying Token contract to Sepolia testnet..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please create .env file with PRIVATE_KEY"
    echo "   Format: PRIVATE_KEY=0x... (do NOT use 'export' in .env file)"
    echo "   Example: PRIVATE_KEY=0x1234567890abcdef..."
    exit 1
fi

# Load environment variables and export them to child processes
# Note: .env file should use format PRIVATE_KEY=0x... (without 'export')
# This script uses 'set -a' to automatically export all variables to child processes
set -a  # Automatically export all variables
source .env
set +a  # Stop automatically exporting

# Check if PRIVATE_KEY is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "Error: PRIVATE_KEY not set in .env file"
    exit 1
fi

# Use Sepolia RPC (public endpoint, no API key needed)
RPC_URL="${SEPOLIA_RPC_URL:-https://rpc.sepolia.dev}"

echo "Using RPC: $RPC_URL"
echo "Private key loaded (last 4 chars: ${PRIVATE_KEY: -4})"

# Check if verification is enabled
if [ -n "$ETHERSCAN_API_KEY" ]; then
    echo "Contract verification enabled (Etherscan API key found)"
else
    echo "Contract verification disabled (ETHERSCAN_API_KEY not set)"
    echo "   Deployment will proceed without verification"
fi
echo ""

# Deploy contract
# PRIVATE_KEY is now exported and available to forge via vm.envUint()
# --verify flag is only added if ETHERSCAN_API_KEY is set
forge script contracts/script/DeploySepolia.s.sol:DeploySepolia \
    --rpc-url "$RPC_URL" \
    --broadcast \
    ${ETHERSCAN_API_KEY:+--verify --etherscan-api-key "$ETHERSCAN_API_KEY"} \
    -vvv

echo ""
echo "Deployment complete!"
echo ""
echo "Next steps:"
echo "   1. Copy the deployed contract address"
echo "   2. Add TOKEN_ADDRESS to your .env file"
echo "   3. Use the address in your frontend"
