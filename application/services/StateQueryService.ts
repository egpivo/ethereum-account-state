import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { Token } from "../../domain/entities/Token.js";

/**
 * @application Service: StateQueryService
 * @description Application service for querying on-chain state
 * 
 * Demonstrates understanding of:
 * - Storage state (direct reads)
 * - Historical state (event-based reconstruction)
 */
export class StateQueryService {
  constructor(private readonly provider: ethers.Provider) {}

  /**
   * Query ETH balance (eth_getBalance)
   */
  async getEthBalance(address: Address): Promise<Balance> {
    const balance = await this.provider.getBalance(address.getValue());
    return Balance.from(balance);
  }

  /**
   * Query token balance via eth_call
   */
  async getTokenBalance(
    tokenAddress: Address,
    accountAddress: Address
  ): Promise<Balance> {
    const tokenInterface = new ethers.Interface([
      "function balanceOf(address account) external view returns (uint256)",
    ]);

    const data = tokenInterface.encodeFunctionData("balanceOf", [
      accountAddress.getValue(),
    ]);

    const result = await this.provider.call({
      to: tokenAddress.getValue(),
      data,
    });

    const decoded = tokenInterface.decodeFunctionResult("balanceOf", result);
    return Balance.from(decoded[0]);
  }

  /**
   * Query total supply via eth_call
   */
  async getTotalSupply(tokenAddress: Address): Promise<Balance> {
    const tokenInterface = new ethers.Interface([
      "function totalSupply() external view returns (uint256)",
    ]);

    const data = tokenInterface.encodeFunctionData("totalSupply", []);

    const result = await this.provider.call({
      to: tokenAddress.getValue(),
      data,
    });

    const decoded = tokenInterface.decodeFunctionResult("totalSupply", result);
    return Balance.from(decoded[0]);
  }

  /**
   * Reconstruct token state from events (historical state)
   * 
   * **Correctness**: When given complete event history (all events, no reorgs),
   * this method produces state that matches on-chain storage and maintains
   * invariants (sum(balances) == totalSupply). This is validated by comprehensive tests.
   * 
   * **Boundary**: In production, reconstruction may be incomplete due to:
   * - Pagination limits (not all events retrieved)
   * - Chain reorganizations (events from orphaned blocks)
   * - Missing historical data
   * In such cases, this is "best-effort diagnostic" rather than a verifier.
   * 
   * Event Semantics:
   * - Mint: Creates new tokens, increases totalSupply
   * - Transfer(to != address(0)): Moves tokens between accounts, totalSupply unchanged
   * - Transfer(to == address(0)): ERC20 canonical burn signal, decreases totalSupply
   * - Burn: Explicit burn event (redundant with Transfer(..., address(0), ...))
   * 
   * CRITICAL: The contract emits both Burn and Transfer(..., address(0), ...) for burns.
   * Both events represent the SAME burn operation but have different logIndex values.
   * 
   * Deduplication Strategy:
   * - Use Transfer(..., address(0), ...) as the canonical burn signal (always processed)
   * - Use transaction-level flag (hasTransferBurn) to track if a transaction has ANY Transfer(..., address(0), ...)
   * - Skip ALL Burn events from transactions that have Transfer(..., address(0), ...)
   * - This ensures each burn operation is processed exactly once, maintaining sum(balances) == totalSupply
   * 
   * Multiple Burns per Transaction (Batch/Multicall Support):
   * - The implementation correctly handles multiple burns per transaction:
   *   - If a transaction has multiple burn operations (e.g., via multicall), each emits Burn + Transfer(..., address(0), ...)
   *   - We process ALL Transfer(..., address(0), ...) events (one per burn operation)
   *   - We skip ALL Burn events if the transaction has any Transfer(..., address(0), ...)
   *   - This works because we process events chronologically and use Transfer(..., address(0), ...) as canonical
   * 
   * **Canonical Event Source**:
   * - Transfer(..., address(0), ...) is the **canonical** burn signal (ERC20 standard)
   * - Burn events are **redundant** and are only used as a fallback if Transfer(..., address(0), ...) is missing
   * - This design choice ensures compatibility with ERC20 tooling and standard event parsers
   * - For batch burns: All Transfer(..., address(0), ...) events are processed, all Burn events are skipped
   * 
   * Implementation:
   * 1. First pass: Scan transaction for Transfer(..., address(0), ...) events, set hasTransferBurn flag
   * 2. Second pass: Process ALL Transfer(..., address(0), ...) as canonical burns, skip ALL Burn if hasTransferBurn is true
   */
  async reconstructStateFromEvents(
    tokenAddress: Address,
    fromBlock: number = 0
  ): Promise<Token> {
    const token = Token.create(tokenAddress);
    const tokenInterface = new ethers.Interface([
      "event Mint(address indexed to, uint256 amount)",
      "event Transfer(address indexed from, address indexed to, uint256 amount)",
      "event Burn(address indexed from, uint256 amount)",
    ]);

    const currentBlock = await this.provider.getBlockNumber();
    const filter = {
      address: tokenAddress.getValue(),
      fromBlock,
      toBlock: currentBlock,
    };

    const logs = await this.provider.getLogs(filter);

    // Group logs by transaction hash to handle out-of-order events within the same transaction
    // This prevents double-counting when Burn events come before Transfer(..., address(0), ...) events
    const logsByTx = new Map<string, Array<{ 
      log: ethers.Log; 
      parsed: ethers.LogDescription; 
      blockNumber: number;
      transactionIndex: number;
      logIndex: number;
    }>>();
    
    // First pass: parse and group all logs by transaction, preserving ordering information
    for (const log of logs) {
      try {
        const parsed = tokenInterface.parseLog(log);
        if (parsed) {
          const txHash = log.transactionHash;
          if (!logsByTx.has(txHash)) {
            logsByTx.set(txHash, []);
          }
          
          // Extract ordering information for robust sorting
          // Use blockNumber, transactionIndex, and log.index for tuple-based sorting
          const blockNumber = log.blockNumber !== null ? Number(log.blockNumber) : 0;
          const transactionIndex = log.transactionIndex !== null ? Number(log.transactionIndex) : 0;
          const logIndex = log.index !== null && log.index !== undefined ? Number(log.index) : 0;
          
          logsByTx.get(txHash)!.push({ 
            log, 
            parsed,
            blockNumber,
            transactionIndex,
            logIndex
          });
        }
      } catch (error) {
        // Skip unparseable logs
        console.warn(`Failed to parse log: ${log.transactionHash}`, error);
      }
    }

    // Second pass: process logs grouped by transaction, in chronological order
    // First, sort transactions by blockNumber + transactionIndex to ensure correct cross-transaction ordering
    // This does not rely on getLogs() return order, which may not be guaranteed
    const sortedTxEntries = Array.from(logsByTx.entries()).sort((a, b) => {
      // Get minimum blockNumber and transactionIndex for each transaction
      const aMin = a[1].reduce((min, log) => {
        if (log.blockNumber < min.blockNumber || 
            (log.blockNumber === min.blockNumber && log.transactionIndex < min.transactionIndex)) {
          return { blockNumber: log.blockNumber, transactionIndex: log.transactionIndex };
        }
        return min;
      }, { blockNumber: a[1][0].blockNumber, transactionIndex: a[1][0].transactionIndex });
      
      const bMin = b[1].reduce((min, log) => {
        if (log.blockNumber < min.blockNumber || 
            (log.blockNumber === min.blockNumber && log.transactionIndex < min.transactionIndex)) {
          return { blockNumber: log.blockNumber, transactionIndex: log.transactionIndex };
        }
        return min;
      }, { blockNumber: b[1][0].blockNumber, transactionIndex: b[1][0].transactionIndex });
      
      // Sort by blockNumber first, then transactionIndex
      if (aMin.blockNumber !== bMin.blockNumber) {
        return aMin.blockNumber - bMin.blockNumber;
      }
      return aMin.transactionIndex - bMin.transactionIndex;
    });
    
    // Process events: Use Transfer(..., address(0), ...) as canonical burn signal
    // Implementation matches contract documentation: "Reconstruction must use Transfer(..., address(0), ...)
    // as canonical signal and skip Burn events from the same transaction"
    // 
    // Deduplication Strategy:
    // - Uses transaction-level flag (hasTransferBurn), NOT logIndex-based keys
    // - Reason: Burn and Transfer(..., address(0), ...) have different logIndex values, so logIndex cannot be used
    // - Works for single burn per transaction (current Token contract) and multiple burns (future batch/multicall)
    // - For multiple burns: Process ALL Transfer(..., address(0), ...) events, skip ALL Burn events
    
    for (const [txHash, txLogs] of sortedTxEntries) {
      // Sort logs within transaction by tuple: (blockNumber, transactionIndex, logIndex)
      // This ensures chronological order even if log.index is missing
      const sortedLogs = txLogs.sort((a, b) => {
        if (a.blockNumber !== b.blockNumber) return a.blockNumber - b.blockNumber;
        if (a.transactionIndex !== b.transactionIndex) return a.transactionIndex - b.transactionIndex;
        return a.logIndex - b.logIndex;
      });
      
      // First pass: Check if this transaction has any Transfer(..., address(0), ...) events
      // This implements the contract's requirement: "skip Burn events from the same transaction"
      // that has Transfer(..., address(0), ...)
      let hasTransferBurn = false;
      for (const { parsed, log } of sortedLogs) {
        if (parsed.name === "Transfer") {
          try {
            const to = Address.from(parsed.args.to);
            if (to.isZero()) {
              hasTransferBurn = true;
              break; // Found Transfer burn, this transaction will skip Burn events
            }
          } catch (error) {
            // Invalid address in event - log warning and skip this event
            console.warn(
              `Invalid address in Transfer event (tx: ${log.transactionHash}):`,
              error
            );
            // Continue processing other events
          }
        }
      }
      
      // Second pass: process events in chronological order
      // This implements: "Reconstruction must use Transfer(..., address(0), ...) as canonical signal"
      for (const { parsed, log } of sortedLogs) {
        try {
          if (parsed.name === "Mint") {
            const to = Address.from(parsed.args.to);
            const amount = Balance.from(parsed.args.amount);
            token.mint(to, amount);
          } else if (parsed.name === "Transfer") {
            const from = Address.from(parsed.args.from);
            const to = Address.from(parsed.args.to);
            const amount = Balance.from(parsed.args.amount);
            
            // Transfer to address(0) is the ERC20 canonical burn signal
            // This is the canonical signal as documented in Token.sol
            if (to.isZero()) {
              // Always process Transfer(..., address(0), ...) as the canonical burn
              // This matches the contract documentation requirement
              token.burn(from, amount);
            } else {
              // Normal transfer
              token.transfer(from, to, amount);
            }
          } else if (parsed.name === "Burn") {
            // CRITICAL: Skip Burn events if this transaction has Transfer(..., address(0), ...)
            // This matches the contract documentation: "Burn events from the same transaction must be skipped"
            // Both events represent the same burn operation but have different logIndex values
            // Using tx-level flag (not logIndex-based) ensures correct deduplication
            if (!hasTransferBurn) {
              // Fallback: process Burn event only if there's no Transfer(..., address(0), ...) in this transaction
              // (This should not happen in our contract, but handles edge cases)
              const from = Address.from(parsed.args.from);
              const amount = Balance.from(parsed.args.amount);
              token.burn(from, amount);
            }
            // If hasTransferBurn is true, skip this Burn event completely (as documented in Token.sol)
          }
        } catch (error) {
          // Handle errors in Address.from() or Balance.from() calls
          // Invalid event arguments (e.g., invalid address format, negative amounts) will be skipped
          // This prevents the entire reconstruction from crashing due to malformed events
          console.warn(
            `Failed to process ${parsed.name} event (tx: ${log.transactionHash}, logIndex: ${log.logIndex}):`,
            error
          );
          // Continue processing other events - best-effort reconstruction
        }
      }
    }

    return token;
  }

  /**
   * Compare storage state vs derived state (for diagnostic purposes)
   * 
   * **Note**: This is a diagnostic tool, not a production verifier.
   * Event-based reconstruction can be incomplete (see reconstructStateFromEvents).
   */
  async compareState(
    tokenAddress: Address,
    accountAddress: Address
  ): Promise<{
    storageBalance: Balance;
    derivedBalance: Balance;
    match: boolean;
  }> {
    const storageBalance = await this.getTokenBalance(
      tokenAddress,
      accountAddress
    );

    // Reconstruct from events
    const reconstructedToken = await this.reconstructStateFromEvents(
      tokenAddress
    );
    const derivedBalance = reconstructedToken.getBalance(accountAddress);

    return {
      storageBalance,
      derivedBalance,
      match: storageBalance.equals(derivedBalance),
    };
  }
}
