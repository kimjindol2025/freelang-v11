// FreeLang v9 Package: fl-math
// 수학 유틸리티 패키지

export const flMathFunctions: Record<string, any> = {
  // 기초 함수
  "math:abs": (x: number) => Math.abs(x),
  "math:floor": (x: number) => Math.floor(x),
  "math:ceil": (x: number) => Math.ceil(x),
  "math:round": (x: number) => Math.round(x),
  "math:sqrt": (x: number) => Math.sqrt(x),
  "math:pow": (x: number, y: number) => Math.pow(x, y),
  "math:log": (x: number) => Math.log(x),
  "math:log2": (x: number) => Math.log2(x),
  "math:log10": (x: number) => Math.log10(x),

  // 삼각함수
  "math:sin": (x: number) => Math.sin(x),
  "math:cos": (x: number) => Math.cos(x),
  "math:tan": (x: number) => Math.tan(x),
  "math:asin": (x: number) => Math.asin(x),
  "math:acos": (x: number) => Math.acos(x),
  "math:atan": (x: number) => Math.atan(x),
  "math:atan2": (y: number, x: number) => Math.atan2(y, x),

  // 통계
  "math:mean": (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length,
  "math:sum": (arr: number[]) => arr.reduce((a, b) => a + b, 0),
  "math:max": (arr: number[]) =>
    arr.length === 0 ? -Infinity : Math.max(...arr),
  "math:min": (arr: number[]) =>
    arr.length === 0 ? Infinity : Math.min(...arr),
  "math:median": (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  },
  "math:variance": (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return (
      arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / arr.length
    );
  },
  "math:stddev": (arr: number[]) => {
    const variance =
      arr.length === 0
        ? 0
        : (() => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            return (
              arr.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) /
              arr.length
            );
          })();
    return Math.sqrt(variance);
  },

  // 정수 관련
  "math:gcd": (a: number, b: number): number => {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    while (b !== 0) {
      [a, b] = [b, a % b];
    }
    return a;
  },
  "math:lcm": (a: number, b: number): number => {
    const g = Math.abs(Math.floor(a));
    const h = Math.abs(Math.floor(b));
    if (g === 0 || h === 0) return 0;
    const gcd = (() => {
      let x = g;
      let y = h;
      while (y !== 0) [x, y] = [y, x % y];
      return x;
    })();
    return (g / gcd) * h;
  },
  "math:clamp": (x: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, x)),
  "math:lerp": (a: number, b: number, t: number) => a + (b - a) * t,

  // 상수
  "math:pi": Math.PI,
  "math:e": Math.E,
  "math:tau": Math.PI * 2,
  "math:phi": (1 + Math.sqrt(5)) / 2,
};

export function registerFlMath(registry: any): void {
  for (const [name, fn] of Object.entries(flMathFunctions)) {
    registry[name] = fn;
  }
}
