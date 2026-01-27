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
   * **Important Boundary**: This is an educational and diagnostic technique, not a verifier.
   * It can be incomplete without pagination, reorg handling, or storage-first reconciliation.
   * 
   * Event Semantics:
   * - Mint: Creates new tokens, increases totalSupply
   * - Transfer(to != address(0)): Moves tokens between accounts, totalSupply unchanged
   * - Transfer(to == address(0)): ERC20 canonical burn signal, decreases totalSupply
   * - Burn: Explicit burn event (redundant with Transfer(..., address(0), ...))
   * 
   * CRITICAL: The contract emits both Burn and Transfer(..., address(0), ...) for burns.
   * To avoid double-counting, we use Transfer(..., address(0), ...) as the canonical signal
   * and skip Burn events from the same transaction.
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
    const logsByTx = new Map<string, Array<{ log: ethers.Log; parsed: ethers.LogDescription }>>();
    
    // First pass: parse and group all logs by transaction
    for (const log of logs) {
      try {
        const parsed = tokenInterface.parseLog(log);
        if (parsed) {
          const txHash = log.transactionHash;
          if (!logsByTx.has(txHash)) {
            logsByTx.set(txHash, []);
          }
          logsByTx.get(txHash)!.push({ log, parsed });
        }
      } catch (error) {
        // Skip unparseable logs
        console.warn(`Failed to parse log: ${log.transactionHash}`, error);
      }
    }

    // Second pass: process logs grouped by transaction
    // For each transaction, process Transfer events first, then Burn events
    // This ensures Transfer(..., address(0), ...) is processed before Burn, preventing double-counting
    for (const [txHash, txLogs] of logsByTx.entries()) {
      // Track if this transaction has a burn via Transfer(..., address(0), ...)
      let hasTransferBurn = false;
      
      // Process Transfer events first
      for (const { parsed } of txLogs) {
        if (parsed.name === "Transfer") {
          const from = Address.from(parsed.args.from);
          const to = Address.from(parsed.args.to);
          const amount = Balance.from(parsed.args.amount);
          
          // Transfer to address(0) is the ERC20 canonical burn signal
          if (to.isZero()) {
            // This is a burn via Transfer event
            token.burn(from, amount);
            hasTransferBurn = true;
          } else {
            // Normal transfer
            token.transfer(from, to, amount);
          }
        }
      }
      
      // Process Mint events
      for (const { parsed } of txLogs) {
        if (parsed.name === "Mint") {
          const to = Address.from(parsed.args.to);
          const amount = Balance.from(parsed.args.amount);
          token.mint(to, amount);
        }
      }
      
      // Process Burn events last - skip if Transfer(..., address(0), ...) was already processed
      for (const { parsed } of txLogs) {
        if (parsed.name === "Burn") {
          // Skip Burn events if we already processed Transfer(..., address(0), ...) from the same transaction
          // This prevents double-counting: both events represent the same burn operation
          if (hasTransferBurn) {
            // Already processed via Transfer(..., address(0), ...), skip to avoid double-count
            continue;
          }
          
          // Fallback: Process Burn event if Transfer(..., address(0), ...) was not emitted
          // (This should not happen in our contract, but handles edge cases)
          const from = Address.from(parsed.args.from);
          const amount = Balance.from(parsed.args.amount);
          token.burn(from, amount);
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
