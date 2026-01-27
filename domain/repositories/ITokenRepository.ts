import { Address } from "../value-objects/Address.js";
import { Token } from "../entities/Token.js";

/**
 * @domain Repository Interface: ITokenRepository
 * @description Abstraction for token state persistence and retrieval
 */
export interface ITokenRepository {
  /**
   * Get token state by contract address
   */
  getByAddress(address: Address): Promise<Token | null>;

  /**
   * Save token state
   */
  save(token: Token): Promise<void>;
}
