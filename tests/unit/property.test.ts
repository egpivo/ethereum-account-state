import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { Address } from "../../domain/value-objects/Address.js";
import { Balance } from "../../domain/value-objects/Balance.js";
import { Token } from "../../domain/entities/Token.js";

// ---------------------------------------------------------------------------
// Arbitraries — reusable generators for domain types
// ---------------------------------------------------------------------------

/** Generate a 40-char hex string for Ethereum addresses */
const arbHex40 = () => fc.stringMatching(/^[0-9a-f]{40}$/);

/** Generate a valid Ethereum address (0x + 40 hex chars, non-zero) */
const arbAddress = () =>
  arbHex40()
    .map((hex) => Address.from(`0x${hex}`))
    .filter((addr) => !addr.isZero());

/** Generate a positive balance (1 to 10^18) */
const arbBalance = () =>
  fc.bigInt({ min: 1n, max: 10n ** 18n }).map((v) => Balance.from(v));

/** Generate a list of distinct addresses */
const arbDistinctAddresses = (count: number) =>
  fc
    .uniqueArray(arbHex40(), {
      minLength: count,
      maxLength: count,
    })
    .map((hexes) => hexes.map((h) => Address.from(`0x${h}`)))
    .filter((addrs) => addrs.every((a) => !a.isZero()));

// ---------------------------------------------------------------------------
// Balance Value Object — Arithmetic Properties
// ---------------------------------------------------------------------------

describe("Property: Balance Arithmetic", () => {
  it("add is commutative: a + b == b + a", () => {
    fc.assert(
      fc.property(arbBalance(), arbBalance(), (a, b) => {
        expect(a.add(b).getValue()).toBe(b.add(a).getValue());
      })
    );
  });

  it("add is associative: (a + b) + c == a + (b + c)", () => {
    fc.assert(
      fc.property(arbBalance(), arbBalance(), arbBalance(), (a, b, c) => {
        const left = a.add(b).add(c);
        const right = a.add(b.add(c));
        expect(left.getValue()).toBe(right.getValue());
      })
    );
  });

  it("zero is identity: a + 0 == a", () => {
    fc.assert(
      fc.property(arbBalance(), (a) => {
        expect(a.add(Balance.zero()).getValue()).toBe(a.getValue());
      })
    );
  });

  it("subtract inverse: (a + b) - b == a", () => {
    fc.assert(
      fc.property(arbBalance(), arbBalance(), (a, b) => {
        const sum = a.add(b);
        expect(sum.subtract(b).getValue()).toBe(a.getValue());
      })
    );
  });

  it("comparison consistency: a >= b iff a - b does not throw", () => {
    fc.assert(
      fc.property(arbBalance(), arbBalance(), (a, b) => {
        const gte = a.isGreaterThanOrEqual(b);
        if (gte) {
          expect(() => a.subtract(b)).not.toThrow();
        } else {
          expect(() => a.subtract(b)).toThrow();
        }
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Token Invariant — sum(balances) == totalSupply
// ---------------------------------------------------------------------------

/** Operation type for random token sequences */
type Op =
  | { type: "mint"; toIdx: number; amount: bigint }
  | { type: "transfer"; fromIdx: number; toIdx: number; amount: bigint }
  | { type: "burn"; fromIdx: number; amount: bigint };

/** Generate a random sequence of token operations */
const arbOps = (numActors: number) =>
  fc.array(
    fc.oneof(
      fc.record({
        type: fc.constant("mint" as const),
        toIdx: fc.integer({ min: 0, max: numActors - 1 }),
        amount: fc.bigInt({ min: 1n, max: 10n ** 12n }),
      }),
      fc.record({
        type: fc.constant("transfer" as const),
        fromIdx: fc.integer({ min: 0, max: numActors - 1 }),
        toIdx: fc.integer({ min: 0, max: numActors - 1 }),
        amount: fc.bigInt({ min: 1n, max: 10n ** 12n }),
      }),
      fc.record({
        type: fc.constant("burn" as const),
        fromIdx: fc.integer({ min: 0, max: numActors - 1 }),
        amount: fc.bigInt({ min: 1n, max: 10n ** 12n }),
      })
    ),
    { minLength: 1, maxLength: 50 }
  );

describe("Property: Token Invariant under Random Operations", () => {
  const NUM_ACTORS = 5;

  it("sum(balances) == totalSupply after any valid operation sequence", () => {
    fc.assert(
      fc.property(
        arbDistinctAddresses(NUM_ACTORS),
        arbOps(NUM_ACTORS),
        (actors, ops) => {
          const contractAddr = Address.from(
            "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
          );
          const token = Token.create(contractAddr);

          // Seed each actor with initial balance
          for (const actor of actors) {
            token.mint(actor, Balance.from(10n ** 15n));
          }

          // Apply random operations (skip invalid ones)
          for (const op of ops) {
            try {
              switch (op.type) {
                case "mint":
                  token.mint(actors[op.toIdx], Balance.from(op.amount));
                  break;
                case "transfer":
                  token.transfer(
                    actors[op.fromIdx],
                    actors[op.toIdx],
                    Balance.from(op.amount)
                  );
                  break;
                case "burn":
                  token.burn(actors[op.fromIdx], Balance.from(op.amount));
                  break;
              }
            } catch {
              // Skip invalid operations (insufficient balance, etc.)
            }
          }

          // Invariant must hold after every sequence
          expect(token.verifyInvariant()).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("totalSupply is non-negative after any operation sequence", () => {
    fc.assert(
      fc.property(
        arbDistinctAddresses(NUM_ACTORS),
        arbOps(NUM_ACTORS),
        (actors, ops) => {
          const token = Token.create(
            Address.from("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
          );

          for (const actor of actors) {
            token.mint(actor, Balance.from(10n ** 15n));
          }

          for (const op of ops) {
            try {
              switch (op.type) {
                case "mint":
                  token.mint(actors[op.toIdx], Balance.from(op.amount));
                  break;
                case "transfer":
                  token.transfer(
                    actors[op.fromIdx],
                    actors[op.toIdx],
                    Balance.from(op.amount)
                  );
                  break;
                case "burn":
                  token.burn(actors[op.fromIdx], Balance.from(op.amount));
                  break;
              }
            } catch {
              // Skip invalid operations
            }
          }

          expect(token.getTotalSupply().getValue()).toBeGreaterThanOrEqual(0n);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// StateTransition — Validation Consistency
// ---------------------------------------------------------------------------

describe("Property: Mint always succeeds for valid inputs", () => {
  it("mint(validAddress, positiveAmount) never throws", () => {
    fc.assert(
      fc.property(arbAddress(), arbBalance(), (to, amount) => {
        const token = Token.create(
          Address.from("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
        );
        expect(() => token.mint(to, amount)).not.toThrow();
      })
    );
  });
});

describe("Property: Transfer conservation", () => {
  it("transfer does not change totalSupply", () => {
    fc.assert(
      fc.property(arbDistinctAddresses(2), arbBalance(), (actors, amount) => {
        const token = Token.create(
          Address.from("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC")
        );
        const [from, to] = actors;

        // Mint enough to cover transfer
        const mintAmount = amount.add(Balance.from(1n));
        token.mint(from, mintAmount);

        const supplyBefore = token.getTotalSupply().getValue();
        token.transfer(from, to, amount);
        const supplyAfter = token.getTotalSupply().getValue();

        expect(supplyAfter).toBe(supplyBefore);
      })
    );
  });
});
