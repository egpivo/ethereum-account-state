import { describe, it, expect, beforeEach } from "vitest";
import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { StateQueryService } from "../../application/services/StateQueryService.js";

/**
 * Test suite for StateQueryService.reconstructStateFromEvents
 * 
 * This tests the most fragile logic in the system:
 * 1. Event ordering (chronological processing)
 * 2. Burn deduplication (preventing double-counting)
 * 3. Batch burn handling (multiple burns per transaction)
 * 4. Cross-transaction ordering
 * 
 * These tests validate the "correctness-first" claim by ensuring
 * the event reconstruction logic maintains invariants.
 */
describe("StateQueryService - Event Reconstruction", () => {
  let mockProvider: ethers.Provider;
  let service: StateQueryService;
  let tokenAddress: Address;
  let tokenInterface: ethers.Interface;

  beforeEach(() => {
    tokenAddress = Address.from("0x1234567890123456789012345678901234567890");
    tokenInterface = new ethers.Interface([
      "event Mint(address indexed to, uint256 amount)",
      "event Transfer(address indexed from, address indexed to, uint256 amount)",
      "event Burn(address indexed from, uint256 amount)",
    ]);

    // Create a mock provider
    mockProvider = {
      getBlockNumber: async () => Promise.resolve(1000n),
      getLogs: async () => Promise.resolve([]),
    } as unknown as ethers.Provider;

    service = new StateQueryService(mockProvider);
  });

  /**
   * Helper to create a mock log entry
   */
  function createMockLog(
    eventName: string,
    args: any,
    blockNumber: number,
    transactionIndex: number,
    logIndex: number,
    txHash: string
  ): ethers.Log {
    const event = tokenInterface.getEvent(eventName);
    if (!event) {
      throw new Error(`Event ${eventName} not found`);
    }

    // encodeEventLog expects args as an array in the order defined by the event
    // For Mint: [to, amount]
    // For Transfer: [from, to, amount]
    // For Burn: [from, amount]
    let orderedArgs: any[];
    if (eventName === "Mint") {
      orderedArgs = [args.to, args.amount];
    } else if (eventName === "Transfer") {
      orderedArgs = [args.from, args.to, args.amount];
    } else if (eventName === "Burn") {
      orderedArgs = [args.from, args.amount];
    } else {
      throw new Error(`Unknown event: ${eventName}`);
    }

    const topics = tokenInterface.encodeEventLog(event, orderedArgs);
    return {
      address: tokenAddress.getValue(),
      blockHash: `0x${blockNumber.toString(16).padStart(64, "0")}`,
      blockNumber: BigInt(blockNumber),
      data: topics.data,
      index: BigInt(logIndex),
      removed: false,
      topics: topics.topics,
      transactionHash: txHash,
      transactionIndex: BigInt(transactionIndex),
    };
  }

  describe("Event Ordering", () => {
    it("should process events in chronological order (Mint before Transfer)", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      // Same transaction: Mint at logIndex 0, Transfer at logIndex 1
      // If processed out of order, Transfer would fail with "Insufficient balance"
      const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const logs = [
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0, // logIndex 0
          txHash
        ),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: bob.getValue(), amount: 500n },
          100,
          0,
          1, // logIndex 1 (after Mint)
          txHash
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should succeed: Mint processed first, then Transfer
      expect(token.getBalance(alice).getValue()).toBe(500n);
      expect(token.getBalance(bob).getValue()).toBe(500n);
      expect(token.getTotalSupply().getValue()).toBe(1000n);
      expect(token.verifyInvariant()).toBe(true);
    });

    it("should handle out-of-order events within same transaction", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      // Same transaction: Transfer at logIndex 0, Mint at logIndex 1
      // getLogs might return them in wrong order, but reconstruction should sort correctly
      const txHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
      const logs = [
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: bob.getValue(), amount: 500n },
          100,
          0,
          1, // logIndex 1 (but returned first)
          txHash
        ),
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0, // logIndex 0 (but returned second)
          txHash
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should succeed: Events sorted by logIndex before processing
      expect(token.getBalance(alice).getValue()).toBe(500n);
      expect(token.getBalance(bob).getValue()).toBe(500n);
      expect(token.getTotalSupply().getValue()).toBe(1000n);
      expect(token.verifyInvariant()).toBe(true);
    });

    it("should process cross-transaction events in correct order", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      // Transaction 1 (block 100, txIndex 0): Mint to Alice
      // Transaction 2 (block 100, txIndex 1): Transfer from Alice to Bob
      // getLogs might return them in wrong order, but reconstruction should sort correctly
      const logs = [
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: bob.getValue(), amount: 500n },
          100,
          1, // txIndex 1 (but returned first)
          0,
          "0xtx2"
        ),
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0, // txIndex 0 (but returned second)
          0,
          "0xtx1"
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should succeed: Transactions sorted by (blockNumber, transactionIndex)
      expect(token.getBalance(alice).getValue()).toBe(500n);
      expect(token.getBalance(bob).getValue()).toBe(500n);
      expect(token.getTotalSupply().getValue()).toBe(1000n);
      expect(token.verifyInvariant()).toBe(true);
    });
  });

  describe("Burn Deduplication", () => {
    it("should prevent double-counting when Burn and Transfer(0) are in same transaction", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const zeroAddress = Address.zero();

      // Same transaction emits both Burn and Transfer(..., address(0), ...)
      // Both represent the same burn operation but have different logIndex values
      const txHash = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
      const logs = [
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0,
          "0xmint"
        ),
        createMockLog(
          "Burn",
          { from: alice.getValue(), amount: 300n },
          100,
          1,
          1, // logIndex 1
          txHash
        ),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: zeroAddress.getValue(), amount: 300n },
          100,
          1,
          2, // logIndex 2 (different from Burn)
          txHash
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should process Transfer(0) as canonical burn, skip Burn event
      // Result: 1000 minted - 300 burned = 700 remaining
      expect(token.getBalance(alice).getValue()).toBe(700n);
      expect(token.getTotalSupply().getValue()).toBe(700n);
      expect(token.verifyInvariant()).toBe(true);
    });

    it("should handle Burn before Transfer(0) in same transaction", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const zeroAddress = Address.zero();

      // Burn event comes before Transfer(0) in same transaction
      // Should still deduplicate correctly using transaction-level flag
      const txHash = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
      const logs = [
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0,
          "0xmint"
        ),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: zeroAddress.getValue(), amount: 300n },
          100,
          1,
          2, // logIndex 2 (after Burn)
          txHash
        ),
        createMockLog(
          "Burn",
          { from: alice.getValue(), amount: 300n },
          100,
          1,
          1, // logIndex 1 (before Transfer)
          txHash
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should process Transfer(0) as canonical burn, skip Burn event
      // Even though Burn comes first in logIndex, the two-pass approach handles it correctly
      expect(token.getBalance(alice).getValue()).toBe(700n);
      expect(token.getTotalSupply().getValue()).toBe(700n);
      expect(token.verifyInvariant()).toBe(true);
    });

    it("should handle multiple burns in same transaction (batch burns)", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const zeroAddress = Address.zero();

      // Same transaction has multiple burns (e.g., via multicall)
      // Each burn emits both Burn and Transfer(0)
      // Should process ALL Transfer(0) events, skip ALL Burn events
      const txHash = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
      const logs = [
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0,
          "0xmint"
        ),
        // First burn
        createMockLog(
          "Burn",
          { from: alice.getValue(), amount: 200n },
          100,
          1,
          1,
          txHash
        ),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: zeroAddress.getValue(), amount: 200n },
          100,
          1,
          2,
          txHash
        ),
        // Second burn
        createMockLog(
          "Burn",
          { from: alice.getValue(), amount: 300n },
          100,
          1,
          3,
          txHash
        ),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: zeroAddress.getValue(), amount: 300n },
          100,
          1,
          4,
          txHash
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should process both Transfer(0) events (200 + 300 = 500 burned)
      // Should skip both Burn events
      // Result: 1000 minted - 500 burned = 500 remaining
      expect(token.getBalance(alice).getValue()).toBe(500n);
      expect(token.getTotalSupply().getValue()).toBe(500n);
      expect(token.verifyInvariant()).toBe(true);
    });

    it("should use Burn as fallback if Transfer(0) is missing", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");

      // Edge case: Only Burn event, no Transfer(0)
      // Should process Burn as fallback (shouldn't happen in our contract, but handles edge cases)
      const txHash = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      const logs = [
        createMockLog(
          "Mint",
          { to: alice.getValue(), amount: 1000n },
          100,
          0,
          0,
          "0xmint"
        ),
        createMockLog(
          "Burn",
          { from: alice.getValue(), amount: 300n },
          100,
          1,
          1,
          txHash
        ),
        // No Transfer(0) event
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Should process Burn as fallback
      expect(token.getBalance(alice).getValue()).toBe(700n);
      expect(token.getTotalSupply().getValue()).toBe(700n);
      expect(token.verifyInvariant()).toBe(true);
    });
  });

  describe("Complex Scenarios", () => {
    it("should maintain invariant across complex event sequence", async () => {
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");
      const zeroAddress = Address.zero();

      // Complex sequence:
      // 1. Mint to Alice (1000)
      // 2. Transfer Alice -> Bob (300)
      // 3. Burn from Bob (100) - has both Burn and Transfer(0)
      // 4. Mint to Bob (500)
      // 5. Transfer Bob -> Alice (200)
      const logs = [
        createMockLog("Mint", { to: alice.getValue(), amount: 1000n }, 100, 0, 0, "0xtx1"),
        createMockLog(
          "Transfer",
          { from: alice.getValue(), to: bob.getValue(), amount: 300n },
          100,
          1,
          0,
          "0xtx2"
        ),
        createMockLog(
          "Burn",
          { from: bob.getValue(), amount: 100n },
          100,
          2,
          0,
          "0xtx3"
        ),
        createMockLog(
          "Transfer",
          { from: bob.getValue(), to: zeroAddress.getValue(), amount: 100n },
          100,
          2,
          1,
          "0xtx3"
        ),
        createMockLog("Mint", { to: bob.getValue(), amount: 500n }, 100, 3, 0, "0xtx4"),
        createMockLog(
          "Transfer",
          { from: bob.getValue(), to: alice.getValue(), amount: 200n },
          100,
          4,
          0,
          "0xtx5"
        ),
      ];

      mockProvider.getLogs = async () => Promise.resolve(logs);

      const token = await service.reconstructStateFromEvents(tokenAddress);

      // Expected state:
      // Alice: 1000 - 300 + 200 = 900
      // Bob: 300 - 100 + 500 - 200 = 500
      // Total supply: 1000 - 100 + 500 = 1400
      expect(token.getBalance(alice).getValue()).toBe(900n);
      expect(token.getBalance(bob).getValue()).toBe(500n);
      expect(token.getTotalSupply().getValue()).toBe(1400n);
      expect(token.verifyInvariant()).toBe(true);
    });
  });
});
