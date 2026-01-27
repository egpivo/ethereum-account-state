import { describe, it, expect } from "vitest";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { Account } from "../../domain/entities/Account.js";
import { Token } from "../../domain/entities/Token.js";
import { StateTransition } from "../../domain/services/StateTransition.js";

describe("Domain Layer", () => {
  describe("Address", () => {
    it("should create valid address", () => {
      const address = Address.from("0x1234567890123456789012345678901234567890");
      expect(address.getValue()).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should reject invalid address", () => {
      expect(() => Address.from("invalid")).toThrow();
    });

    it("should detect zero address", () => {
      const zero = Address.zero();
      expect(zero.isZero()).toBe(true);
    });
  });

  describe("Balance", () => {
    it("should create balance from bigint", () => {
      const balance = Balance.from(1000n);
      expect(balance.getValue()).toBe(1000n);
    });

    it("should add balances", () => {
      const a = Balance.from(100n);
      const b = Balance.from(200n);
      const sum = a.add(b);
      expect(sum.getValue()).toBe(300n);
    });

    it("should subtract balances", () => {
      const a = Balance.from(300n);
      const b = Balance.from(100n);
      const diff = a.subtract(b);
      expect(diff.getValue()).toBe(200n);
    });

    it("should reject negative balance", () => {
      expect(() => Balance.from(-1n)).toThrow();
    });

    it("should reject insufficient balance", () => {
      const a = Balance.from(100n);
      const b = Balance.from(200n);
      expect(() => a.subtract(b)).toThrow();
    });
  });

  describe("Account", () => {
    it("should create account", () => {
      const address = Address.from("0x1234567890123456789012345678901234567890");
      const account = Account.create(address);
      expect(account.getBalance().getValue()).toBe(0n);
    });

    it("should credit tokens", () => {
      const account = Account.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      account.credit(Balance.from(1000n));
      expect(account.getBalance().getValue()).toBe(1000n);
    });

    it("should debit tokens", () => {
      const account = Account.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      account.credit(Balance.from(1000n));
      account.debit(Balance.from(300n));
      expect(account.getBalance().getValue()).toBe(700n);
    });

    it("should reject debit with insufficient balance", () => {
      const account = Account.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      account.credit(Balance.from(100n));
      expect(() => account.debit(Balance.from(200n))).toThrow();
    });
  });

  describe("Token", () => {
    it("should create token", () => {
      const address = Address.from("0x1234567890123456789012345678901234567890");
      const token = Token.create(address);
      expect(token.getTotalSupply().getValue()).toBe(0n);
    });

    it("should mint tokens", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const to = Address.from("0x1111111111111111111111111111111111111111");
      token.mint(to, Balance.from(1000n));
      expect(token.getBalance(to).getValue()).toBe(1000n);
      expect(token.getTotalSupply().getValue()).toBe(1000n);
    });

    it("should transfer tokens", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      token.mint(alice, Balance.from(1000n));
      token.transfer(alice, bob, Balance.from(300n));

      expect(token.getBalance(alice).getValue()).toBe(700n);
      expect(token.getBalance(bob).getValue()).toBe(300n);
      expect(token.getTotalSupply().getValue()).toBe(1000n);
    });

    it("should preserve invariant after operations", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      token.mint(alice, Balance.from(1000n));
      token.mint(bob, Balance.from(2000n));
      token.transfer(alice, bob, Balance.from(300n));
      token.burn(bob, Balance.from(500n));

      expect(token.verifyInvariant()).toBe(true);
    });
  });

  describe("StateTransition", () => {
    it("should validate legal transfer", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      token.mint(alice, Balance.from(1000n));
      const result = StateTransition.validateTransfer(
        token,
        alice,
        bob,
        Balance.from(300n)
      );

      expect(result.valid).toBe(true);
    });

    it("should reject illegal transfer (insufficient balance)", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const alice = Address.from("0x1111111111111111111111111111111111111111");
      const bob = Address.from("0x2222222222222222222222222222222222222222");

      token.mint(alice, Balance.from(100n));
      const result = StateTransition.validateTransfer(
        token,
        alice,
        bob,
        Balance.from(200n)
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Insufficient balance");
    });

    it("should reject transfer to zero address", () => {
      const token = Token.create(
        Address.from("0x1234567890123456789012345678901234567890")
      );
      const alice = Address.from("0x1111111111111111111111111111111111111111");

      token.mint(alice, Balance.from(1000n));
      const result = StateTransition.validateTransfer(
        token,
        alice,
        Address.zero(),
        Balance.from(100n)
      );

      expect(result.valid).toBe(false);
    });
  });
});
