/**
 * @domain Value Object: Address
 * @description Represents an Ethereum address with validation
 */
export class Address {
  private constructor(private readonly value: string) {
    if (!this.isValidEthereumAddress(value)) {
      throw new Error(`Invalid Ethereum address: ${value}`);
    }
  }

  static from(value: string): Address {
    return new Address(value);
  }

  static zero(): Address {
    return Address.from("0x0000000000000000000000000000000000000000");
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Address): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }

  isZero(): boolean {
    return this.equals(Address.zero());
  }

  toString(): string {
    return this.value;
  }
}
