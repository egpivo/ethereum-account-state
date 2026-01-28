.PHONY: help install build test clean deploy-local deploy-sepolia frontend-install frontend-dev frontend-build

# Default target
help:
	@echo "Available commands:"
	@echo "  make install          - Install Node.js dependencies"
	@echo "  make build            - Build contracts and TypeScript"
	@echo "  make test             - Run all tests (Foundry + TypeScript)"
	@echo "  make test-foundry      - Run Foundry tests only"
	@echo "  make test-unit         - Run TypeScript unit tests only"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make deploy-local     - Deploy to local Anvil network"
	@echo "  make deploy-sepolia   - Deploy to Sepolia testnet"
	@echo "  make frontend-install - Install frontend dependencies"
	@echo "  make frontend-dev     - Start frontend development server"
	@echo "  make frontend-build   - Build frontend for production"
	@echo "  make lint             - Run linters"

# Install dependencies
install:
	@echo "Installing Node.js dependencies..."
	npm install

# Build contracts and TypeScript
build:
	@echo "Building contracts..."
	forge build
	@echo "Building TypeScript..."
	npm run build

# Run all tests
test:
	@echo "Running all tests..."
	npm test

# Run Foundry tests
test-foundry:
	@echo "Running Foundry tests..."
	forge test

# Run TypeScript unit tests
test-unit:
	@echo "Running TypeScript unit tests..."
	npm run test:unit

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	forge clean
	rm -rf dist
	rm -rf frontend/dist
	rm -rf frontend/node_modules/.vite
	@echo "Clean complete"

# Deploy to local Anvil network
deploy-local:
	@echo "Deploying to local Anvil network..."
	@echo "Checking if Anvil is running..."
	@if ! lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1 ; then \
		echo "❌ Error: Anvil is not running on port 8545"; \
		echo "Please start Anvil first: anvil"; \
		echo "Or run in another terminal: anvil"; \
		exit 1; \
	fi
	@echo "✅ Anvil is running"
	npm run deploy:local

# Deploy to Sepolia testnet
deploy-sepolia:
	@echo "Deploying to Sepolia testnet..."
	@echo "Make sure .env file exists with PRIVATE_KEY"
	npm run deploy:sepolia

# Frontend commands
frontend-install:
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

frontend-dev:
	@echo "Starting frontend development server..."
	cd frontend && npm run dev

frontend-build:
	@echo "Building frontend for production..."
	cd frontend && npm run build

# Run linters
lint:
	@echo "Running linters..."
	npm run lint

# Setup: Install all dependencies
setup: install frontend-install
	@echo "Setup complete!"

# Full clean: Remove all dependencies and build artifacts
clean-all: clean
	@echo "Removing node_modules..."
	rm -rf node_modules
	rm -rf frontend/node_modules
	@echo "Full clean complete"
