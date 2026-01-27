import { Address } from "../value-objects/Address.js";
import { Balance } from "../value-objects/Balance.js";

/**
 * @domain Entity: Account
 * @description Represents an Ethereum account with token balance
 * @aggregate Account is the aggregate root for account-related operations
 */
export class Account {
  constructor(
    private readonly address: Address,
    private balance: Balance
  ) {
    if (address.isZero()) {
      throw new Error("Account address cannot be zero");
    }
  }

  static create(address: Address): Account {
    return new Account(address, Balance.zero());
  }

  getAddress(): Address {
    return this.address;
  }

  getBalance(): Balance {
    return this.balance;
  }

  /**
   * @domain State Transition: Credit tokens to account
   */
  credit(amount: Balance): void {
    this.balance = this.balance.add(amount);
  }

  /**
   * @domain State Transition: Debit tokens from account
   * @throws Error if insufficient balance
   */
  debit(amount: Balance): void {
    if (this.balance.isGreaterThanOrEqual(amount)) {
      this.balance = this.balance.subtract(amount);
    } else {
      throw new Error(
        `Insufficient balance: required ${amount.toString()}, available ${this.balance.toString()}`
      );
    }
  }

  hasSufficientBalance(amount: Balance): boolean {
    return this.balance.isGreaterThanOrEqual(amount);
  }
}
