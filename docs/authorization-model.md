# Authorization Model

## Overview

This document defines the authorization model for the Token contract, specifying who can perform which operations and how authorization is enforced.

## Current Authorization Model

### Design Philosophy

The current implementation follows a **minimal authorization model** suitable for:
- Educational purposes
- Testing and development
- Simple use cases where minting authority is not restricted

**Important**: For production use, you may want to add minting restrictions (see "Extension: Restricted Minting" below).

## Operation Authorization

### 1. Mint Operation

**Function**: `mint(address to, uint256 amount)`

**Authorization**: **Public** (anyone can call)

**Current Implementation**:
```solidity
function mint(address to, uint256 amount) external {
    // No authorization check - anyone can mint
    // Only validates: to != address(0) and amount > 0
}
```

**Rationale**:
- This is a **minimal ledger implementation** focused on state machine correctness
- No minting authority is enforced by default
- Suitable for educational/testing scenarios

**Security Implications**:
- ⚠️ **Anyone can create tokens** - unlimited supply possible
- ⚠️ **No access control** - no restriction on who can mint
- ✅ **State machine correctness** - invariant still maintained

**When to Use**:
- Educational projects
- Testing environments
- Simple tokens where minting is intentionally unrestricted

**When NOT to Use**:
- Production tokens with fixed supply
- Tokens requiring minting authority
- Tokens with governance-controlled minting

### 2. Transfer Operation

**Function**: `transfer(address to, uint256 amount)`

**Authorization**: **Self-only** (only the token owner can transfer their own tokens)

**Implementation**:
```solidity
function transfer(address to, uint256 amount) external {
    address from = msg.sender;  // Authorization: only caller can transfer their own tokens
    // ... rest of implementation
}
```

**Authorization Mechanism**:
- Uses `msg.sender` to identify the token owner
- Only the account that owns the tokens can transfer them
- No approval mechanism (no `approve`/`transferFrom` like ERC20)

**Rationale**:
- Standard ownership model: you can only spend your own tokens
- Simpler than ERC20's approval system
- Sufficient for basic token functionality

**Security Implications**:
- ✅ **Secure**: Only token owners can transfer their tokens
- ✅ **No approval attacks**: No risk of approval-based vulnerabilities
- ⚠️ **No delegation**: Cannot delegate spending authority to others

### 3. Burn Operation

**Function**: `burn(uint256 amount)`

**Authorization**: **Self-only** (only the token owner can burn their own tokens)

**Implementation**:
```solidity
function burn(uint256 amount) external {
    address from = msg.sender;  // Authorization: only caller can burn their own tokens
    // ... rest of implementation
}
```

**Authorization Mechanism**:
- Uses `msg.sender` to identify the token owner
- Only the account that owns the tokens can burn them
- Must have sufficient balance

**Rationale**:
- Standard ownership model: you can only destroy your own tokens
- Prevents unauthorized supply reduction
- Maintains supply integrity

**Security Implications**:
- ✅ **Secure**: Only token owners can burn their tokens
- ✅ **Supply integrity**: No unauthorized supply reduction
- ✅ **Balance check**: Must have sufficient balance to burn

## Authorization Summary Table

| Operation | Authorization | Mechanism | Can Be Extended? |
|-----------|--------------|-----------|-----------------|
| `mint` | Public (anyone) | None | Yes (see below) |
| `transfer` | Self-only | `msg.sender` | No (by design) |
| `burn` | Self-only | `msg.sender` | No (by design) |

## Extension: Restricted Minting

For production use, you may want to restrict minting. Here are common patterns:

### Pattern 1: Owner-Based Minting

```solidity
address public owner;

modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}

function mint(address to, uint256 amount) external onlyOwner {
    // ... implementation
}
```

### Pattern 2: Role-Based Minting

```solidity
mapping(address => bool) public minters;

modifier onlyMinter() {
    require(minters[msg.sender], "Not minter");
    _;
}

function mint(address to, uint256 amount) external onlyMinter {
    // ... implementation
}
```

### Pattern 3: Governance-Controlled Minting

```solidity
address public governance;

modifier onlyGovernance() {
    require(msg.sender == governance, "Not governance");
    _;
}

function mint(address to, uint256 amount) external onlyGovernance {
    // ... implementation
}
```

### Pattern 4: Cap-Based Minting

```solidity
uint256 public maxSupply;

function mint(address to, uint256 amount) external {
    require(totalSupply + amount <= maxSupply, "Exceeds max supply");
    // ... implementation
}
```

## Authorization vs. Validation

It's important to distinguish between:

1. **Authorization**: Who can perform an operation
2. **Validation**: Whether the operation is valid

### Current Implementation

| Operation | Authorization Check | Validation Checks |
|-----------|-------------------|------------------|
| `mint` | None | `to != address(0)`, `amount > 0` |
| `transfer` | `msg.sender` is owner | `to != address(0)`, `amount > 0`, `balance >= amount` |
| `burn` | `msg.sender` is owner | `amount > 0`, `balance >= amount` |

## Security Considerations

### Current Model Risks

1. **Unlimited Minting**:
   - Risk: Anyone can mint unlimited tokens
   - Impact: Inflation, loss of value
   - Mitigation: Add minting restrictions for production

2. **No Approval System**:
   - Risk: Cannot delegate spending authority
   - Impact: Less flexible than ERC20
   - Mitigation: Add `approve`/`transferFrom` if needed

### Current Model Strengths

1. **Simple and Clear**:
   - Easy to understand authorization rules
   - No complex permission systems
   - Suitable for educational purposes

2. **Secure Transfers**:
   - Only owners can transfer their tokens
   - No approval-based vulnerabilities
   - Standard ownership model

3. **Secure Burns**:
   - Only owners can burn their tokens
   - Prevents unauthorized supply reduction
   - Maintains supply integrity

## Design Decision: Why Public Minting?

The current implementation allows anyone to mint tokens. This is a **conscious design decision** for:

1. **Educational Focus**: The project focuses on state machine correctness, not production security
2. **Simplicity**: Avoids complexity of permission systems
3. **Flexibility**: Easy to extend with authorization if needed
4. **Testing**: Simplifies testing scenarios

**For Production**: Always add appropriate authorization controls based on your use case.

## Best Practices

### For Educational/Testing Use

- ✅ Current model is acceptable
- ✅ Document the authorization model clearly
- ✅ Explain security implications

### For Production Use

- ⚠️ **Must** add minting restrictions
- ⚠️ **Consider** adding approval system if needed
- ⚠️ **Audit** authorization logic thoroughly
- ✅ Use battle-tested patterns (OpenZeppelin, etc.)

## Comparison with ERC20

| Feature | This Implementation | ERC20 Standard |
|---------|-------------------|----------------|
| Mint Authorization | Public (configurable) | Not specified |
| Transfer Authorization | Self-only | Self-only |
| Burn Authorization | Self-only | Self-only |
| Approval System | No | Yes (`approve`/`transferFrom`) |
| Delegation | No | Yes (via approvals) |

## Conclusion

The current authorization model is:
- **Simple**: Easy to understand and reason about
- **Secure for transfers/burns**: Only owners can move/destroy their tokens
- **Flexible**: Can be extended with authorization controls
- **Educational**: Focuses on state machine correctness

**Key Takeaway**: Always document your authorization model clearly, and add appropriate restrictions for production use.
