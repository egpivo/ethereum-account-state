import { Address } from "../value-objects/Address.js";
import { Balance } from "../value-objects/Balance.js";
import { Token } from "../entities/Token.js";

/**
 * @domain Service: StateTransition
 * @description Domain service for validating and executing state transitions
 */
export class StateTransition {
  /**
   * Validates if a transfer transition is legal
   */
  static validateTransfer(
    token: Token,
    from: Address,
    to: Address,
    amount: Balance
  ): { valid: boolean; reason?: string } {
    if (to.isZero()) {
      return { valid: false, reason: "Cannot transfer to zero address" };
    }

    if (amount.getValue() === 0n) {
      return {
        valid: false,
        reason: "Transfer amount must be greater than zero",
      };
    }

    const fromBalance = token.getBalance(from);
    if (!fromBalance.isGreaterThanOrEqual(amount)) {
      return {
        valid: false,
        reason: `Insufficient balance: required ${amount.toString()}, available ${fromBalance.toString()}`,
      };
    }

    return { valid: true };
  }

  /**
   * Validates if a mint transition is legal
   */
  static validateMint(
    token: Token,
    to: Address,
    amount: Balance
  ): { valid: boolean; reason?: string } {
    if (to.isZero()) {
      return { valid: false, reason: "Cannot mint to zero address" };
    }

    if (amount.getValue() === 0n) {
      return { valid: false, reason: "Mint amount must be greater than zero" };
    }

    return { valid: true };
  }

  /**
   * Validates if a burn transition is legal
   */
  static validateBurn(
    token: Token,
    from: Address,
    amount: Balance
  ): { valid: boolean; reason?: string } {
    if (amount.getValue() === 0n) {
      return { valid: false, reason: "Burn amount must be greater than zero" };
    }

    const fromBalance = token.getBalance(from);
    if (!fromBalance.isGreaterThanOrEqual(amount)) {
      return {
        valid: false,
        reason: `Insufficient balance: required ${amount.toString()}, available ${fromBalance.toString()}`,
      };
    }

    return { valid: true };
  }
}
