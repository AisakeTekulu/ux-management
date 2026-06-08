import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  generateToken,
  generateUniqueToken,
  MIN_TOKEN_LENGTH,
  type RandomSource,
} from '@/lib/domain/share-link';

/**
 * Property-based test for share-link token generation (design Property 15).
 *
 * The `generateToken` and `generateUniqueToken` functions produce URL-safe
 * tokens from an injected {@link RandomSource}. This property verifies that:
 *
 * 1. Every generated token is at least {@link MIN_TOKEN_LENGTH} (32) characters.
 * 2. Every token contains only URL-safe characters: A-Z, a-z, 0-9, -, _.
 * 3. All tokens in a generated sequence are pairwise distinct.
 *
 * **Validates: Requirements 8.1**
 */

// Feature: client-sign-off-dashboard, Property 15: Share-link token generation

// --- Deterministic RandomSource stub ---

/**
 * Creates a deterministic RandomSource from a seed. Each call to `randomBytes`
 * produces a unique sequence derived from the seed and an internal counter,
 * ensuring distinct outputs across calls within the same stub instance.
 */
function createDeterministicRandomSource(seed: number): RandomSource {
  let counter = 0;

  return {
    randomBytes(size: number): Uint8Array {
      const bytes = new Uint8Array(size);
      // Simple deterministic PRNG (xorshift-like) seeded by seed + counter
      let state = (seed ^ 0xdeadbeef) + counter * 0x9e3779b9;
      for (let i = 0; i < size; i++) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        bytes[i] = (state >>> 0) & 0xff;
      }
      counter++;
      return bytes;
    },
  };
}

// --- Regex for URL-safe characters ---

const URL_SAFE_REGEX = /^[A-Za-z0-9\-_]+$/;

// --- Property Test ---

describe('Share-link token generation (Property 15)', () => {
  // Feature: client-sign-off-dashboard, Property 15: Share-link token generation
  it('every token ≥32 chars, URL-safe, pairwise distinct across a sequence', () => {
    fc.assert(
      fc.property(
        // Seed for the deterministic RNG
        fc.integer({ min: 0, max: 2 ** 31 - 1 }),
        // Sequence length: generate between 2 and 50 tokens per run
        fc.integer({ min: 2, max: 50 }),
        (seed, sequenceLength) => {
          const rng = createDeterministicRandomSource(seed);
          const tokens: string[] = [];

          for (let i = 0; i < sequenceLength; i++) {
            const token = generateToken(rng);
            tokens.push(token);
          }

          // Property 1: Every token is at least MIN_TOKEN_LENGTH (32) characters
          for (const token of tokens) {
            expect(token.length).toBeGreaterThanOrEqual(MIN_TOKEN_LENGTH);
          }

          // Property 2: Every token uses only URL-safe characters (A-Z, a-z, 0-9, -, _)
          for (const token of tokens) {
            expect(token).toMatch(URL_SAFE_REGEX);
          }

          // Property 3: All tokens in the sequence are pairwise distinct
          const uniqueTokens = new Set(tokens);
          expect(uniqueTokens.size).toBe(tokens.length);
        },
      ),
      { numRuns: 100 },
    );
  });
});
