# FreeLang v11 vs 타언어 알고리즘 성능 벤치마크

**검증일**: 2026-04-22  
**테스트 환경**: Node.js v25, Python 3.12, Go 1.21, TypeScript 5.4, Rust 1.75

---

## 📊 벤치마크 결과 (ms)

| 알고리즘 | 입력 | FreeLang | TypeScript | Python | Go | Rust | 최적 |
|---------|------|----------|-----------|--------|-----|------|------|
| **Fibonacci (재귀)** | fib(35) | TBD | TBD | TBD | TBD | TBD | Rust |
| **Fibonacci (동적계획)** | fib(35) | TBD | TBD | TBD | TBD | TBD | Rust |
| **Quick Sort** | 10K 정수 | TBD | TBD | TBD | TBD | TBD | Rust |
| **Merge Sort** | 10K 정수 | TBD | TBD | TBD | TBD | TBD | Rust |
| **HashMap Lookup** | 100K ops | TBD | TBD | TBD | TBD | TBD | Rust |
| **Binary Search** | 1M 정수 | TBD | TBD | TBD | TBD | TBD | Rust |
| **Tree Traversal** | 1K 노드 | TBD | TBD | TBD | TBD | TBD | Go |
| **Recursion Depth** | 10K 깊이 | TBD | TBD | TBD | TBD | TBD | Go |
| **String Matching** | 1M 문자 | TBD | TBD | TBD | TBD | TBD | Rust |
| **JSON Parsing** | 1M JSON | TBD | TBD | TBD | TBD | TBD | Rust |

---

## 🔧 벤치마크 구현

### FreeLang v11 구현

```fl
; benchmark.fl - 성능 벤치마크 스위트

(module benchmark
  (:export run-benchmark))

; Fibonacci (재귀 - 직순)
(defun fib-recursive (n)
  (cond
    [(< n 2) n]
    [else (+ (fib-recursive (- n 1))
             (fib-recursive (- n 2)))]))

; Fibonacci (동적계획)
(defun fib-dp (n)
  (let ((memo (new-map)))
    (defun fib-inner (x)
      (cond
        [(< x 2) x]
        [(contains? memo x) (get memo x)]
        [else
         (let ((result (+ (fib-inner (- x 1))
                          (fib-inner (- x 2)))))
           (set! memo x result)
           result)]))
    (fib-inner n)))

; Quick Sort
(defun quicksort (arr)
  (cond
    [(empty? arr) arr]
    [else
     (let* ((pivot (first arr))
            (rest (rest arr))
            (smaller (filter #(< %1 pivot) rest))
            (larger (filter #(>= %1 pivot) rest)))
       (concat (quicksort smaller)
               (list pivot)
               (quicksort larger)))]))

; Merge Sort
(defun merge (left right)
  (cond
    [(empty? left) right]
    [(empty? right) left]
    [(< (first left) (first right))
     (cons (first left) (merge (rest left) right))]
    [else
     (cons (first right) (merge left (rest right)))]))

(defun mergesort (arr)
  (cond
    [(<= (length arr) 1) arr]
    [else
     (let* ((mid (div (length arr) 2))
            (left (take arr mid))
            (right (drop arr mid)))
       (merge (mergesort left) (mergesort right)))]))

; HashMap Lookup Test
(defun benchmark-hashmap (size)
  (let ((map (new-map)))
    ; Insert
    (loop-range i 0 size
      (set! map i (str "value-" i)))
    ; Lookup
    (loop-range i 0 size
      (get map i))))

; Binary Search
(defun binary-search (arr target)
  (defun search-inner (left right)
    (cond
      [(> left right) -1]
      [else
       (let ((mid (div (+ left right) 2)))
         (cond
           [(= (get arr mid) target) mid]
           [(< (get arr mid) target) (search-inner (+ mid 1) right)]
           [else (search-inner left (- mid 1))]))]))
  (search-inner 0 (- (length arr) 1)))

; Run all benchmarks
(defun run-benchmark ()
  (list
    {:name "fib-recursive-35"
     :fn #(fib-recursive 35)}
    {:name "fib-dp-35"
     :fn #(fib-dp 35)}
    {:name "quicksort-10k"
     :fn #(quicksort (range 0 10000))}
    {:name "mergesort-10k"
     :fn #(mergesort (range 0 10000))}
    {:name "hashmap-100k"
     :fn #(benchmark-hashmap 100000)}
    {:name "binary-search-1m"
     :fn #(binary-search (range 0 1000000) 500000)}))
```

### TypeScript 구현

```typescript
// benchmark.ts

interface BenchmarkResult {
  name: string;
  timeMs: number;
  opsPerSec: number;
}

class AlgorithmBenchmark {
  // Fibonacci (재귀)
  fibRecursive(n: number): number {
    if (n < 2) return n;
    return this.fibRecursive(n - 1) + this.fibRecursive(n - 2);
  }

  // Fibonacci (동적계획)
  fibDp(n: number): number {
    const memo: Map<number, number> = new Map();
    const fib = (x: number): number => {
      if (x < 2) return x;
      if (memo.has(x)) return memo.get(x)!;
      const result = fib(x - 1) + fib(x - 2);
      memo.set(x, result);
      return result;
    };
    return fib(n);
  }

  // Quick Sort
  quickSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;
    const pivot = arr[0];
    const smaller = arr.slice(1).filter(x => x < pivot);
    const larger = arr.slice(1).filter(x => x >= pivot);
    return [...this.quickSort(smaller), pivot, ...this.quickSort(larger)];
  }

  // Merge Sort
  mergeSort(arr: number[]): number[] {
    if (arr.length <= 1) return arr;
    const mid = Math.floor(arr.length / 2);
    const left = this.mergeSort(arr.slice(0, mid));
    const right = this.mergeSort(arr.slice(mid));
    return this.merge(left, right);
  }

  private merge(left: number[], right: number[]): number[] {
    const result: number[] = [];
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] < right[j]) {
        result.push(left[i++]);
      } else {
        result.push(right[j++]);
      }
    }
    return [...result, ...left.slice(i), ...right.slice(j)];
  }

  // HashMap Lookup Test
  benchmarkHashMap(size: number): void {
    const map = new Map<number, string>();
    for (let i = 0; i < size; i++) {
      map.set(i, `value-${i}`);
    }
    for (let i = 0; i < size; i++) {
      map.get(i);
    }
  }

  // Binary Search
  binarySearch(arr: number[], target: number): number {
    let left = 0, right = arr.length - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    return -1;
  }

  // Run benchmarks
  runBenchmarks(): BenchmarkResult[] {
    return [
      this.benchmark("fib-recursive-35", () => this.fibRecursive(35)),
      this.benchmark("fib-dp-35", () => this.fibDp(35)),
      this.benchmark("quicksort-10k", () => {
        const arr = Array.from({length: 10000}, (_, i) => i);
        this.quickSort(arr);
      }),
      this.benchmark("mergesort-10k", () => {
        const arr = Array.from({length: 10000}, (_, i) => i);
        this.mergeSort(arr);
      }),
      this.benchmark("hashmap-100k", () => this.benchmarkHashMap(100000)),
      this.benchmark("binary-search-1m", () => {
        const arr = Array.from({length: 1000000}, (_, i) => i);
        this.binarySearch(arr, 500000);
      }),
    ];
  }

  private benchmark(name: string, fn: () => void): BenchmarkResult {
    const start = performance.now();
    fn();
    const timeMs = performance.now() - start;
    return {
      name,
      timeMs: parseFloat(timeMs.toFixed(2)),
      opsPerSec: Math.round(1000 / timeMs),
    };
  }
}

const bench = new AlgorithmBenchmark();
const results = bench.runBenchmarks();
console.table(results);
```

### Python 구현

```python
# benchmark.py
import time
from functools import lru_cache
from typing import List, Tuple

class AlgorithmBenchmark:
    # Fibonacci (재귀)
    def fib_recursive(self, n: int) -> int:
        if n < 2:
            return n
        return self.fib_recursive(n - 1) + self.fib_recursive(n - 2)

    # Fibonacci (동적계획)
    @lru_cache(maxsize=None)
    def fib_dp(self, n: int) -> int:
        if n < 2:
            return n
        return self.fib_dp(n - 1) + self.fib_dp(n - 2)

    # Quick Sort
    def quicksort(self, arr: List[int]) -> List[int]:
        if len(arr) <= 1:
            return arr
        pivot = arr[0]
        smaller = [x for x in arr[1:] if x < pivot]
        larger = [x for x in arr[1:] if x >= pivot]
        return self.quicksort(smaller) + [pivot] + self.quicksort(larger)

    # Merge Sort
    def mergesort(self, arr: List[int]) -> List[int]:
        if len(arr) <= 1:
            return arr
        mid = len(arr) // 2
        left = self.mergesort(arr[:mid])
        right = self.mergesort(arr[mid:])
        return self._merge(left, right)

    def _merge(self, left: List[int], right: List[int]) -> List[int]:
        result = []
        i = j = 0
        while i < len(left) and j < len(right):
            if left[i] < right[j]:
                result.append(left[i])
                i += 1
            else:
                result.append(right[j])
                j += 1
        return result + left[i:] + right[j:]

    # HashMap Lookup Test
    def benchmark_hashmap(self, size: int):
        d = {i: f"value-{i}" for i in range(size)}
        for i in range(size):
            _ = d[i]

    # Binary Search
    def binary_search(self, arr: List[int], target: int) -> int:
        left, right = 0, len(arr) - 1
        while left <= right:
            mid = (left + right) // 2
            if arr[mid] == target:
                return mid
            elif arr[mid] < target:
                left = mid + 1
            else:
                right = mid - 1
        return -1

    # Run benchmarks
    def run_benchmarks(self) -> List[Tuple[str, float]]:
        results = []
        results.append(self.benchmark("fib-recursive-35", lambda: self.fib_recursive(35)))
        results.append(self.benchmark("fib-dp-35", lambda: self.fib_dp(35)))
        results.append(self.benchmark("quicksort-10k", lambda: self.quicksort(list(range(10000)))))
        results.append(self.benchmark("mergesort-10k", lambda: self.mergesort(list(range(10000)))))
        results.append(self.benchmark("hashmap-100k", lambda: self.benchmark_hashmap(100000)))
        results.append(self.benchmark("binary-search-1m", lambda: self.binary_search(list(range(1000000)), 500000)))
        return results

    def benchmark(self, name: str, fn) -> Tuple[str, float]:
        start = time.perf_counter()
        fn()
        elapsed = (time.perf_counter() - start) * 1000  # Convert to ms
        return (name, round(elapsed, 2))

if __name__ == "__main__":
    bench = AlgorithmBenchmark()
    results = bench.run_benchmarks()
    print("Algorithm Benchmarks (Python)")
    print("=" * 50)
    for name, time_ms in results:
        ops_per_sec = int(1000 / time_ms) if time_ms > 0 else 0
        print(f"{name:25} {time_ms:10.2f} ms  ({ops_per_sec:>8} ops/sec)")
```

### Go 구현

```go
// benchmark.go
package main

import (
	"fmt"
	"time"
)

func fibRecursive(n int) int {
	if n < 2 {
		return n
	}
	return fibRecursive(n-1) + fibRecursive(n-2)
}

func fibDP(n int) int {
	memo := make(map[int]int)
	var fib func(int) int
	fib = func(x int) int {
		if x < 2 {
			return x
		}
		if val, ok := memo[x]; ok {
			return val
		}
		result := fib(x-1) + fib(x-2)
		memo[x] = result
		return result
	}
	return fib(n)
}

func quicksort(arr []int) []int {
	if len(arr) <= 1 {
		return arr
	}
	pivot := arr[0]
	var smaller, larger []int
	for _, x := range arr[1:] {
		if x < pivot {
			smaller = append(smaller, x)
		} else {
			larger = append(larger, x)
		}
	}
	smaller = quicksort(smaller)
	larger = quicksort(larger)
	result := append(smaller, pivot)
	return append(result, larger...)
}

func mergesort(arr []int) []int {
	if len(arr) <= 1 {
		return arr
	}
	mid := len(arr) / 2
	left := mergesort(arr[:mid])
	right := mergesort(arr[mid:])
	return merge(left, right)
}

func merge(left, right []int) []int {
	result := []int{}
	i, j := 0, 0
	for i < len(left) && j < len(right) {
		if left[i] < right[j] {
			result = append(result, left[i])
			i++
		} else {
			result = append(result, right[j])
			j++
		}
	}
	result = append(result, left[i:]...)
	result = append(result, right[j:]...)
	return result
}

func benchmarkHashmap(size int) {
	m := make(map[int]string)
	for i := 0; i < size; i++ {
		m[i] = fmt.Sprintf("value-%d", i)
	}
	for i := 0; i < size; i++ {
		_ = m[i]
	}
}

func binarySearch(arr []int, target int) int {
	left, right := 0, len(arr)-1
	for left <= right {
		mid := (left + right) / 2
		if arr[mid] == target {
			return mid
		} else if arr[mid] < target {
			left = mid + 1
		} else {
			right = mid - 1
		}
	}
	return -1
}

type BenchmarkResult struct {
	name      string
	timeMs    float64
	opsPerSec int64
}

func benchmark(name string, fn func()) BenchmarkResult {
	start := time.Now()
	fn()
	elapsed := time.Since(start)
	timeMs := elapsed.Seconds() * 1000
	opsPerSec := int64(1000 / timeMs)
	return BenchmarkResult{
		name:      name,
		timeMs:    timeMs,
		opsPerSec: opsPerSec,
	}
}

func main() {
	results := []BenchmarkResult{
		benchmark("fib-recursive-35", func() { fibRecursive(35) }),
		benchmark("fib-dp-35", func() { fibDP(35) }),
		benchmark("quicksort-10k", func() {
			arr := make([]int, 10000)
			for i := 0; i < 10000; i++ {
				arr[i] = i
			}
			quicksort(arr)
		}),
		benchmark("mergesort-10k", func() {
			arr := make([]int, 10000)
			for i := 0; i < 10000; i++ {
				arr[i] = i
			}
			mergesort(arr)
		}),
		benchmark("hashmap-100k", func() { benchmarkHashmap(100000) }),
		benchmark("binary-search-1m", func() {
			arr := make([]int, 1000000)
			for i := 0; i < 1000000; i++ {
				arr[i] = i
			}
			binarySearch(arr, 500000)
		}),
	}

	fmt.Println("Algorithm Benchmarks (Go)")
	fmt.Println("==================================================")
	fmt.Printf("%-25s %12s %12s\n", "Test", "Time (ms)", "Ops/sec")
	fmt.Println("==================================================")
	for _, r := range results {
		fmt.Printf("%-25s %12.2f %12d\n", r.name, r.timeMs, r.opsPerSec)
	}
}
```

### Rust 구현

```rust
// benchmark.rs
use std::collections::HashMap;
use std::time::Instant;

fn fib_recursive(n: u32) -> u64 {
    match n {
        0..=1 => n as u64,
        _ => fib_recursive(n - 1) + fib_recursive(n - 2),
    }
}

fn fib_dp(n: u32) -> u64 {
    let mut memo: HashMap<u32, u64> = HashMap::new();
    fn fib_inner(x: u32, memo: &mut HashMap<u32, u64>) -> u64 {
        if x < 2 {
            return x as u64;
        }
        if let Some(&val) = memo.get(&x) {
            return val;
        }
        let result = fib_inner(x - 1, memo) + fib_inner(x - 2, memo);
        memo.insert(x, result);
        result
    }
    fib_inner(n, &mut memo)
}

fn quicksort(mut arr: Vec<i32>) -> Vec<i32> {
    if arr.len() <= 1 {
        return arr;
    }
    let pivot = arr[0];
    let (mut smaller, mut larger): (Vec<_>, Vec<_>) =
        arr[1..].iter().partition(|&&x| x < pivot);
    smaller.sort_unstable();
    larger.sort_unstable();
    let mut result = quicksort(smaller);
    result.push(pivot);
    result.append(&mut quicksort(larger));
    result
}

fn mergesort(arr: &[i32]) -> Vec<i32> {
    if arr.len() <= 1 {
        return arr.to_vec();
    }
    let mid = arr.len() / 2;
    let left = mergesort(&arr[..mid]);
    let right = mergesort(&arr[mid..]);
    merge(left, right)
}

fn merge(mut left: Vec<i32>, mut right: Vec<i32>) -> Vec<i32> {
    let mut result = Vec::new();
    while !left.is_empty() && !right.is_empty() {
        if left[0] < right[0] {
            result.push(left.remove(0));
        } else {
            result.push(right.remove(0));
        }
    }
    result.append(&mut left);
    result.append(&mut right);
    result
}

fn benchmark_hashmap(size: usize) {
    let mut map = HashMap::new();
    for i in 0..size {
        map.insert(i, format!("value-{}", i));
    }
    for i in 0..size {
        let _ = &map[&i];
    }
}

fn binary_search(arr: &[i32], target: i32) -> i32 {
    let mut left = 0;
    let mut right = arr.len() as i32 - 1;
    while left <= right {
        let mid = (left + right) / 2;
        match arr[mid as usize].cmp(&target) {
            std::cmp::Ordering::Equal => return mid,
            std::cmp::Ordering::Less => left = mid + 1,
            std::cmp::Ordering::Greater => right = mid - 1,
        }
    }
    -1
}

fn benchmark<F>(name: &str, mut f: F) -> (String, f64, i64)
where
    F: FnMut(),
{
    let start = Instant::now();
    f();
    let elapsed = start.elapsed();
    let time_ms = elapsed.as_secs_f64() * 1000.0;
    let ops_per_sec = (1000.0 / time_ms) as i64;
    (name.to_string(), time_ms, ops_per_sec)
}

fn main() {
    let results = vec![
        benchmark("fib-recursive-35", || {
            fib_recursive(35);
        }),
        benchmark("fib-dp-35", || {
            fib_dp(35);
        }),
        benchmark("quicksort-10k", || {
            let arr: Vec<i32> = (0..10000).collect();
            quicksort(arr);
        }),
        benchmark("mergesort-10k", || {
            let arr: Vec<i32> = (0..10000).collect();
            mergesort(&arr);
        }),
        benchmark("hashmap-100k", || {
            benchmark_hashmap(100000);
        }),
        benchmark("binary-search-1m", || {
            let arr: Vec<i32> = (0..1000000).collect();
            binary_search(&arr, 500000);
        }),
    ];

    println!("Algorithm Benchmarks (Rust)");
    println!("==================================================");
    println!("{:25} {:12} {:12}", "Test", "Time (ms)", "Ops/sec");
    println!("==================================================");
    for (name, time_ms, ops_per_sec) in results {
        println!("{:25} {:12.2} {:12}", name, time_ms, ops_per_sec);
    }
}
```

---

## 📈 성능 분석 지표

### 1. **상대 성능 (Normalized)**
```
Rust 기준값 = 1.0x

TypeScript  = X.XXx (JavaScript JIT)
Python      = X.XXx (인터프리터)
Go          = X.XXx (컴파일)
FreeLang    = X.XXx (부트스트랩 인터프리터)
```

### 2. **알고리즘별 특성**

| 알고리즘 | 특징 | 타입 | 예상 우위 |
|---------|------|------|---------|
| Fibonacci 재귀 | 깊은 재귀 | CPU 바운드 | Rust > Go > TypeScript > Python |
| Fibonacci DP | 메모이제이션 | 해시맵 | Rust ≈ Go > TypeScript > Python |
| Quick Sort | 캐시 효율 | CPU 바운드 | Rust > Go > TypeScript > Python |
| Merge Sort | 메모리 할당 | 메모리 바운드 | Rust > Go > TypeScript > Python |
| HashMap | 해시 성능 | 메모리 바운드 | Rust > Go > TypeScript ≈ Python |
| Binary Search | 순차 접근 | CPU 바운드 | 거의 동등 |
| Recursion Depth | 스택 | 시스템 제약 | Go > Rust > TypeScript > Python |

---

## 🎯 검증 계획

- [ ] FreeLang 구현 및 실행
- [ ] TypeScript 구현 및 실행
- [ ] Python 구현 및 실행
- [ ] Go 구현 및 실행
- [ ] Rust 구현 및 컴파일 및 실행
- [ ] 결과 수집 및 정규화
- [ ] 그래프 생성 (시간 비교, 상대 성능)

---

## 결론

**예상 결과**:
- **Rust**: 가장 빠름 (최적화 + 네이티브 바이너리)
- **Go**: 두 번째 (좋은 성능 + 단순함)
- **TypeScript**: 세 번째 (JIT, Node.js 빠름)
- **FreeLang**: 네 번째 (부트스트랩 인터프리터)
- **Python**: 가장 느림 (순수 인터프리터)

FreeLang의 성능은 "AI DSL"이라는 특화 영역에서는 충분하며, 계산 집약적 작업은 [RAW] 블록으로 JavaScript로 탈출 가능.

Generated: 2026-04-22
