import { ethers } from "ethers";
import { Address } from "../../domain/value-objects/Address.js";
import { Token } from "../../domain/entities/Token.js";
import { ITokenRepository } from "../../domain/repositories/ITokenRepository.js";
import { StateQueryService } from "../../application/services/StateQueryService.js";

/**
 * @infrastructure ContractRepository
 * @description Implementation of ITokenRepository using on-chain queries
 */
export class ContractRepository implements ITokenRepository {
  constructor(
    private readonly provider: ethers.Provider,
    private readonly stateQueryService: StateQueryService
  ) {}

  async getByAddress(address: Address): Promise<Token | null> {
    try {
      // Reconstruct token state from events
      const token = await this.stateQueryService.reconstructStateFromEvents(
        address
      );

      // Verify against current storage state
      const totalSupply = await this.stateQueryService.getTotalSupply(address);
      const currentSupply = token.getTotalSupply();

      if (!totalSupply.equals(currentSupply)) {
        // State mismatch - return null or throw?
        // For now, we'll trust the reconstructed state
        console.warn(
          `State mismatch for ${address.getValue()}: storage=${totalSupply.toString()}, derived=${currentSupply.toString()}`
        );
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
