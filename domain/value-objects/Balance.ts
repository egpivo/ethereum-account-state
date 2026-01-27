/**
 * @domain Value Object: Balance
 * @description Represents a token balance with validation
 */
export class Balance {
  private constructor(private readonly value: bigint) {
    if (value < 0n) {
      throw new Error("Balance cannot be negative");
    }
  }

  static from(value: bigint | number | string): Balance {
    const bigintValue = typeof value === "bigint" ? value : BigInt(value);
    return new Balance(bigintValue);
  }

  static zero(): Balance {
    return new Balance(0n);
  }

  getValue(): bigint {
    return this.value;
  }

  add(other: Balance): Balance {
    return new Balance(this.value + other.value);
  }

  subtract(other: Balance): Balance {
    if (this.value < other.value) {
      throw new Error("Insufficient balance");
    }
    return new Balance(this.value - other.value);
  }

  isGreaterThan(other: Balance): boolean {
    return this.value > other.value;
  }

  isGreaterThanOrEqual(other: Balance): boolean {
    return this.value >= other.value;
  }

  equals(other: Balance): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
