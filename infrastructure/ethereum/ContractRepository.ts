import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Token } from "../../domain/entities/Token.js";
import { ITokenRepository } from "../../domain/repositories/ITokenRepository.js";
import { StateQueryService } from "../../application/services/StateQueryService.js";

/**
 * @infrastructure ContractRepository
 * @description Implementation of ITokenRepository using on-chain queries
 *
 * **Design Choice**: Best-effort diagnostic mode (not fail-fast)
 * - State mismatches between storage and event reconstruction are logged but do not throw
 * - This is intentional for educational/diagnostic purposes
 * - Event reconstruction can be incomplete (missing pagination, reorg handling, etc.)
 * - For production use, consider fail-fast behavior or storage-first reconciliation
 */
export class ContractRepository implements ITokenRepository {
  constructor(
    private readonly provider: ethers.Provider,
    private readonly stateQueryService: StateQueryService
  ) {}

  async getByAddress(address: Address): Promise<Token | null> {
    try {
      // Reconstruct token state from events
      const token =
        await this.stateQueryService.reconstructStateFromEvents(address);

      // Verify against current storage state (best-effort diagnostic check)
      const totalSupply = await this.stateQueryService.getTotalSupply(address);
      const currentSupply = token.getTotalSupply();

      if (!totalSupply.equals(currentSupply)) {
        // State mismatch detected - best-effort diagnostic mode (not fail-fast)
        // This is expected in educational/diagnostic contexts where event reconstruction
        // may be incomplete (missing pagination, reorg handling, etc.)
        console.warn(
          `State mismatch for ${address.getValue()}: storage=${totalSupply.toString()}, derived=${currentSupply.toString()}`
        );
        // Continue with reconstructed state for diagnostic purposes
      }

      return token;
    } catch (error) {
      console.error(`Failed to load token at ${address.getValue()}:`, error);
      return null;
    }
  }

  async save(token: Token): Promise<void> {
    // In a pure on-chain system, "saving" means the state is already persisted
    // This method exists for interface compliance but doesn't perform writes
    // State changes happen through transactions, not through repository saves
    throw new Error(
      "Token state cannot be saved directly. Use WalletService to send transactions."
    );
  }
}
