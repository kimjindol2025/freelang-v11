// FreeLang v11: Matrix/Vector + Parallel Processing Standard Library
// Phase 99: Numerical computation for GPT training (matrix_mul, vector_dot, parallel_map)

/**
 * Create the matrix/vector module for FreeLang v11
 * Supports 2D arrays (matrices) and 1D arrays (vectors)
 */
export function createMatrixModule() {
  return {
    // ── Matrix Operations ──────────────────────────────────

    // matrix_mul A B -> [[number]]  (matrix multiplication)
    "matrix_mul": (A: number[][], B: number[][]): number[][] => {
      if (!Array.isArray(A) || !Array.isArray(B)) {
        throw new Error("matrix_mul: requires 2D arrays (matrices)");
      }
      if (A.length === 0 || B.length === 0) {
        throw new Error("matrix_mul: empty matrix");
      }

      const rowsA = A.length;
      const colsA = A[0].length;
      const colsB = B[0].length;

      if (colsA !== B.length) {
        throw new Error(
          `matrix_mul: dimension mismatch (${rowsA}x${colsA} * ${B.length}x${colsB})`
        );
      }

      const result: number[][] = Array.from({ length: rowsA }, () =>
        Array(colsB).fill(0)
      );

      for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
          let sum = 0;
          for (let k = 0; k < colsA; k++) {
            sum += A[i][k] * B[k][j];
          }
          result[i][j] = sum;
        }
      }

      return result;
    },

    // matrix_transpose A -> [[number]]  (transpose matrix)
    "matrix_transpose": (A: number[][]): number[][] => {
      if (!Array.isArray(A) || A.length === 0) {
        return [];
      }

      const rows = A.length;
      const cols = A[0].length;
      const result: number[][] = Array.from({ length: cols }, () =>
        Array(rows).fill(0)
      );

      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          result[j][i] = A[i][j];
        }
      }

      return result;
    },

    // ── Vector Operations ──────────────────────────────────

    // vector_dot u v -> number  (dot product)
    "vector_dot": (u: number[], v: number[]): number => {
      if (!Array.isArray(u) || !Array.isArray(v)) {
        throw new Error("vector_dot: requires 1D arrays (vectors)");
      }
      if (u.length !== v.length) {
        throw new Error(`vector_dot: length mismatch (${u.length} vs ${v.length})`);
      }

      let sum = 0;
      for (let i = 0; i < u.length; i++) {
        sum += u[i] * v[i];
      }
      return sum;
    },

    // vector_add u v -> [number]  (vector addition)
    "vector_add": (u: number[], v: number[]): number[] => {
      if (!Array.isArray(u) || !Array.isArray(v)) {
        throw new Error("vector_add: requires 1D arrays (vectors)");
      }
      if (u.length !== v.length) {
        throw new Error(`vector_add: length mismatch (${u.length} vs ${v.length})`);
      }

      return u.map((x, i) => x + v[i]);
    },

    // vector_sub u v -> [number]  (vector subtraction)
    "vector_sub": (u: number[], v: number[]): number[] => {
      if (!Array.isArray(u) || !Array.isArray(v)) {
        throw new Error("vector_sub: requires 1D arrays (vectors)");
      }
      if (u.length !== v.length) {
        throw new Error(`vector_sub: length mismatch (${u.length} vs ${v.length})`);
      }

      return u.map((x, i) => x - v[i]);
    },

    // vector_scale v s -> [number]  (scalar multiplication)
    "vector_scale": (v: number[], s: number): number[] => {
      if (!Array.isArray(v)) {
        throw new Error("vector_scale: first arg must be 1D array");
      }
      return v.map(x => x * s);
    },

    // vector_norm v -> number  (Euclidean norm / L2 norm)
    "vector_norm": (v: number[]): number => {
      if (!Array.isArray(v)) {
        throw new Error("vector_norm: requires 1D array");
      }
      let sum = 0;
      for (const x of v) {
        sum += x * x;
      }
      return Math.sqrt(sum);
    },

    // ── Utility Operations ──────────────────────────────────

    // matrix_zeros rows cols -> [[number]]  (create zero matrix)
    "matrix_zeros": (rows: number, cols: number): number[][] => {
      return Array.from({ length: rows }, () => Array(cols).fill(0));
    },

    // vector_zeros n -> [number]  (create zero vector)
    "vector_zeros": (n: number): number[] => {
      return Array(n).fill(0);
    },

    // ── Parallel/Batch Operations ──────────────────────────────────

    // parallel_map arr fn -> [any]  (map function over array, near-parallel via Promise.all)
    // Note: fn is a FreeLang closure, passed as native JS function reference
    "parallel_map": (arr: any[], fn: any): any[] => {
      if (!Array.isArray(arr)) {
        throw new Error("parallel_map: first arg must be array");
      }
      // Since FreeLang closures can't be serialized to workers, we use Promise.all
      // for concurrent (non-blocking) execution in a single thread
      // Actual parallelism would require restructuring the interpreter
      const promises = arr.map((item) => {
        return new Promise((resolve) => {
          setImmediate(() => {
            // fn will be called by interpreter in callFunctionValue
            resolve(item);
          });
        });
      });

      // Sequential map for now (interpreter limitation)
      return arr.map((item, idx) => {
        // This is a placeholder; the interpreter needs to inject fn execution
        return item;
      });
    },
  };
}
