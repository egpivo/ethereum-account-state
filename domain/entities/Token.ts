import { Address } from "../value-objects/Address.js";
import { Balance } from "../value-objects/Balance.js";

/**
 * @domain Entity: Token
 * @description Represents the token contract state
 * @aggregate Token is the aggregate root for token state machine
 */
export class Token {
  constructor(
    private readonly contractAddress: Address,
    private totalSupply: Balance,
    private accounts: Map<string, Balance> = new Map()
  ) {}

  static create(contractAddress: Address): Token {
    return new Token(contractAddress, Balance.zero());
  }

  getContractAddress(): Address {
    return this.contractAddress;
  }

  getTotalSupply(): Balance {
    return this.totalSupply;
  }

  getBalance(address: Address): Balance {
    return this.accounts.get(address.getValue()) || Balance.zero();
  }

  /**
   * @domain State Transition: Mint tokens
   * @invariant sum(balances) == totalSupply must hold after this operation
   *           (Guaranteed by construction, cannot be verified on-chain)
   * 
   * @dev Validation rules MUST mirror on-chain contract rules:
   *      - to != address(0) (reverts ZeroAddress)
   *      - amount > 0 (reverts ZeroAmount)
   *      This ensures off-chain reasoning matches on-chain behavior.
   */
  mint(to: Address, amount: Balance): void {
    if (to.isZero()) {
      throw new Error("Cannot mint to zero address");
    }

    if (amount.getValue() === 0n) {
      throw new Error("Mint amount must be greater than zero");
    }

    const currentBalance = this.getBalance(to);
    this.accounts.set(to.getValue(), currentBalance.add(amount));
    this.totalSupply = this.totalSupply.add(amount);
  }

  /**
   * @domain State Transition: Transfer tokens
   * @invariant sum(balances) == totalSupply must hold after this operation
   *           (Guaranteed by construction, cannot be verified on-chain)
   * 
   * @dev Validation rules MUST mirror on-chain contract rules:
   *      - to != address(0) (reverts ZeroAddress)
   *      - amount > 0 (reverts ZeroAmount)
   *      - balances[from] >= amount (reverts InsufficientBalance)
   *      This ensures off-chain reasoning matches on-chain behavior.
   */
  transfer(from: Address, to: Address, amount: Balance): void {
    if (to.isZero()) {
      throw new Error("Cannot transfer to zero address");
    }

    if (amount.getValue() === 0n) {
      throw new Error("Transfer amount must be greater than zero");
    }

    const fromBalance = this.getBalance(from);
    if (!fromBalance.isGreaterThanOrEqual(amount)) {
      throw new Error("Insufficient balance for transfer");
    }

    const toBalance = this.getBalance(to);

    this.accounts.set(from.getValue(), fromBalance.subtract(amount));
    this.accounts.set(to.getValue(), toBalance.add(amount));
  }

  /**
   * @domain State Transition: Burn tokens
   * @invariant sum(balances) == totalSupply must hold after this operation
   *           (Guaranteed by construction, cannot be verified on-chain)
   * 
   * @dev Validation rules MUST mirror on-chain contract rules:
   *      - amount > 0 (reverts ZeroAmount)
   *      - balances[from] >= amount (reverts InsufficientBalance)
   *      This ensures off-chain reasoning matches on-chain behavior.
   */
  burn(from: Address, amount: Balance): void {
    if (amount.getValue() === 0n) {
      throw new Error("Burn amount must be greater than zero");
    }

    const fromBalance = this.getBalance(from);
    if (!fromBalance.isGreaterThanOrEqual(amount)) {
      throw new Error("Insufficient balance for burn");
    }

    this.accounts.set(from.getValue(), fromBalance.subtract(amount));
    this.totalSupply = this.totalSupply.subtract(amount);
  }

  /**
   * @domain Invariant Check: Verify sum(balances) == totalSupply
   * @dev This works in off-chain domain models (TypeScript) because we can iterate Maps.
   *      On-chain, this is impossible because Solidity mappings are not enumerable.
   *      The invariant is guaranteed by construction through state transitions.
   */
  verifyInvariant(): boolean {
    let sum = Balance.zero();
    for (const balance of this.accounts.values()) {
      sum = sum.add(balance);
    }
    return sum.equals(this.totalSupply);
  }
}
