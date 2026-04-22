// FreeLang v11: Bitwise Operations Standard Library
// Provides bitwise AND, OR, XOR, NOT, shift operations
// Essential for CRC32 and other cryptographic operations

/**
 * Create the bitwise operations module for FreeLang
 * Provides: bit_and, bit_or, bit_xor, bit_not, bit_shr, bit_shl
 */
export function createBitsModule() {
  return {
    // bit_and a b -> number (bitwise AND: a & b)
    "bit_and": (a: number, b: number): number => {
      return (a & b) >>> 0; // Ensure unsigned 32-bit
    },

    // bit_or a b -> number (bitwise OR: a | b)
    "bit_or": (a: number, b: number): number => {
      return (a | b) >>> 0;
    },

    // bit_xor a b -> number (bitwise XOR: a ^ b)
    "bit_xor": (a: number, b: number): number => {
      return (a ^ b) >>> 0;
    },

    // bit_not a -> number (bitwise NOT: ~a)
    "bit_not": (a: number): number => {
      return (~a) >>> 0;
    },

    // bit_shl a n -> number (shift left: a << n)
    "bit_shl": (a: number, n: number): number => {
      return (a << n) >>> 0;
    },

    // bit_shr a n -> number (unsigned right shift: a >>> n)
    "bit_shr": (a: number, n: number): number => {
      return (a >>> n) >>> 0;
    },

    // bit_sar a n -> number (arithmetic right shift: a >> n)
    "bit_sar": (a: number, n: number): number => {
      return (a >> n) >>> 0;
    },

    // bit_popcount a -> number (count set bits)
    "bit_popcount": (a: number): number => {
      a = a >>> 0; // Ensure unsigned
      let count = 0;
      while (a) {
        count += a & 1;
        a = a >>> 1;
      }
      return count;
    },

    // bit_test a n -> boolean (test bit at position n)
    "bit_test": (a: number, n: number): boolean => {
      return ((a >>> n) & 1) === 1;
    },

    // bit_set a n -> number (set bit at position n)
    "bit_set": (a: number, n: number): number => {
      return (a | (1 << n)) >>> 0;
    },

    // bit_clear a n -> number (clear bit at position n)
    "bit_clear": (a: number, n: number): number => {
      return (a & ~(1 << n)) >>> 0;
    },

    // bit_rotate_left a n -> number (rotate left: (a << n) | (a >>> (32-n)))
    "bit_rotate_left": (a: number, n: number): number => {
      a = a >>> 0;
      n = n % 32;
      return ((a << n) | (a >>> (32 - n))) >>> 0;
    },

    // bit_rotate_right a n -> number (rotate right: (a >>> n) | (a << (32-n)))
    "bit_rotate_right": (a: number, n: number): number => {
      a = a >>> 0;
      n = n % 32;
      return ((a >>> n) | (a << (32 - n))) >>> 0;
    },
  };
}
