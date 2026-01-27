# Authorization Model

## Overview

This document defines the authorization model for the Token contract.

**Important Design Note**: 
- **Minting is intentionally permissionless** in this minimal implementation
- **Authority separation** (wallet ≠ state ≠ authority) is presented as a **conceptual model**, not an enforced on-chain property
- This is a design choice for educational/testing purposes, demonstrating state machine correctness without access control complexity
- For production use, implement the extension patterns described in this document

## Current Authorization Model

| Operation | Authorization | Mechanism |
|-----------|--------------|-----------|
| `mint` | Public (anyone) | None |
| `transfer` | Self-only | `msg.sender` |
| `burn` | Self-only | `msg.sender` |

## Operation Details

### Mint

**Authorization**: Public (anyone can call)

**Rationale**: Minimal implementation for educational/testing. Suitable for simple use cases where minting is intentionally unrestricted.

**Security Implications**:
- ⚠️ Anyone can create tokens (unlimited supply possible)
- ✅ State machine correctness maintained

**For Production**: Add authorization controls (e.g., `onlyOwner`, `onlyMinter`, `onlyGovernance`).

### Transfer

**Authorization**: Self-only (only token owner can transfer their own tokens)

**Mechanism**: Uses `msg.sender` to identify token owner. No approval mechanism (simpler than ERC20).

**Security**: Only token owners can transfer their tokens. No approval-based vulnerabilities.

### Burn

**Authorization**: Self-only (only token owner can burn their own tokens)

**Mechanism**: Uses `msg.sender` to identify token owner. Must have sufficient balance.

**Security**: Only token owners can burn their tokens. Prevents unauthorized supply reduction.

## Extension Patterns (Production)

### Owner-Based Minting
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}
function mint(...) external onlyOwner { ... }
```

### Role-Based Minting
```solidity
mapping(address => bool) public minters;
modifier onlyMinter() {
    require(minters[msg.sender], "Not minter");
    _;
}
function mint(...) external onlyMinter { ... }
```

### Cap-Based Minting
```solidity
uint256 public maxSupply;
function mint(...) external {
    require(totalSupply + amount <= maxSupply, "Exceeds max supply");
    ...
}
```

## Authorization vs. Validation

- **Authorization**: Who can perform an operation
- **Validation**: Whether the operation is valid

Current implementation:
- `mint`: No authorization check; validates `to != address(0)`, `amount > 0`
- `transfer`: `msg.sender` is owner; validates `to != address(0)`, `amount > 0`, `balance >= amount`
- `burn`: `msg.sender` is owner; validates `amount > 0`, `balance >= amount`

## Best Practices

**For Educational/Testing**: Current model is acceptable. Document clearly.

**For Production**: Must add minting restrictions. Consider approval system if needed. Audit thoroughly.
