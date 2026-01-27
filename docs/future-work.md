# Future Work & Exploratory Features

This document describes features and patterns that are not currently used in the core implementation but may be valuable for future extensions or educational purposes.

## Transient Storage (EIP-1153) for Reentrancy Guards

**Status**: Removed from core implementation (no external calls in current token)

**Why Removed**: The current minimal token implementation has no external calls, making reentrancy guards unnecessary. Including them would be feature-stacking without clear justification.

**When to Add Back**: 
- If future extensions introduce external calls (e.g., ERC777 hooks, cross-chain bridges)
- If implementing more complex token features that require reentrancy protection

**Implementation Pattern** (for reference):
```solidity
library ReentrancyGuard {
    uint256 private constant REENTRANCY_GUARD_SLOT = 
        uint256(keccak256("ReentrancyGuard"));

    function enter() internal {
        uint256 slot = REENTRANCY_GUARD_SLOT;
        assembly {
            tstore(slot, 1)  // 100 gas (vs sstore: 20,000 gas)
        }
    }

    function exit() internal {
        uint256 slot = REENTRANCY_GUARD_SLOT;
        assembly {
            tstore(slot, 0)
        }
    }

    modifier nonReentrant() {
        if (isEntered()) revert ReentrantCall();
        enter();
        _;
        exit();
    }
}
```

**Gas Savings**: ~200 gas per operation (vs traditional storage-based guards)

## DDD Layer Usage Status

### Currently Used Layers

**Domain Layer**:
- ✅ `Token` entity: Used in `StateQueryService.reconstructStateFromEvents()` for event-based state reconstruction
- ✅ `StateTransition` service: Used for domain validation (integrated into `WalletService`)
- ✅ `Address`, `Balance` value objects: Used throughout application layer

**Application Layer**:
- ✅ `WalletService`: Wallet operations (signing, sending transactions)
- ✅ `StateQueryService`: State querying (storage reads, event reconstruction)

**Infrastructure Layer**:
- ✅ `EthereumProvider`: RPC provider factory
- ✅ `ContractRepository`: On-chain state repository

### Exploratory / Future Layers

**Domain Layer**:
- ⚠️ `Account` entity: Defined but not currently used in application services
  - **Future Use**: Could be used for account-level business logic if needed
  - **Current Approach**: Direct use of `Address` and `Balance` value objects is sufficient

**Domain Layer**:
- ⚠️ `ITokenRepository` interface: Defined but not fully utilized
  - **Future Use**: Could enable repository pattern for testability and abstraction
  - **Current Approach**: Direct RPC calls via `StateQueryService` are sufficient

## Design Philosophy

**Principle**: Only include features that are actively used or have clear, immediate value. Avoid "resume engineering" by including unused layers or patterns.

**Current Approach**:
- Core DDD layers (Domain entities, Application services) are actively used
- Unused layers are documented here rather than removed (for educational value)
- Future extensions can leverage these patterns when needed

## Extension Patterns

When extending the system, consider:

1. **Reentrancy Guards**: Add if introducing external calls
2. **Account Entity**: Use if account-level business logic becomes complex
3. **Repository Pattern**: Implement if testability or abstraction becomes important
4. **Additional Domain Services**: Add as business rules become more complex
