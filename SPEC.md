# FreeLang v9 언어 명세서

**버전**: 9.0.0
**작성일**: 2026-04-04
**상태**: 최종 확정

---

## 목차

1. [개요](#개요)
2. [어휘 분석 (렉싱)](#어휘-분석-렉싱)
3. [문법 (파싱)](#문법-파싱)
4. [타입 시스템](#타입-시스템)
5. [표현식](#표현식)
6. [문장](#문장)
7. [함수](#함수)
8. [객체 및 구조체](#객체-및-구조체)
9. [에러 처리](#에러-처리)
10. [비동기 처리](#비동기-처리)
11. [모듈 시스템](#모듈-시스템)
12. [표준 라이브러리](#표준-라이브러리)
13. [런타임 특성](#런타임-특성)

---

## 개요

FreeLang v9는 현대적인 프로그래밍 언어로, 다음 특징을 제공합니다:

- **정적 타입**: 선택적 타입 주석 (TypeScript 스타일)
- **제네릭**: 파라미터화된 타입 및 함수
- **비동기**: async/await 및 Promise 지원
- **포인터**: 저수준 메모리 제어
- **모듈**: 코드 조직 및 재사용
- **패턴 매칭**: 타입 안전한 분기

---

## 어휘 분석 (렉싱)

### 토큰 유형

| 유형 | 설명 | 예시 |
|------|------|------|
| **IDENTIFIER** | 식별자 | `x`, `myVar`, `_private` |
| **KEYWORD** | 예약어 | `fn`, `if`, `async`, `import` |
| **NUMBER** | 수치 리터럴 | `42`, `3.14`, `0xFF` |
| **STRING** | 문자열 리터럴 | `"hello"`, `'world'`, `` `template` `` |
| **OPERATOR** | 연산자 | `+`, `-`, `==`, `&&`, `=>` |
| **LPAREN** | 좌 괄호 | `(` |
| **RPAREN** | 우 괄호 | `)` |
| **LBRACE** | 좌 중괄호 | `{` |
| **RBRACE** | 우 중괄호 | `}` |
| **LBRACKET** | 좌 대괄호 | `[` |
| **RBRACKET** | 우 대괄호 | `]` |
| **SEMICOLON** | 세미콜론 | `;` |
| **COLON** | 콜론 | `:` |
| **COMMA** | 쉼표 | `,` |

### 예약어 (키워드)

```
function  fn      async     await     match
if        else    for       while     do
return    break   continue  throw     try
catch     finally var       const     import
export    as      interface struct    enum
type      mut     ref       ptr       null
undefined true    false
```

### 주석

```freelang
// 한 줄 주석

/* 여러 줄 주석 */
```

---

## 문법 (파싱)

### EBNF 표기법

```ebnf
Program       = Block* ;
Block         = Statement | Declaration ;

Statement     = Expression ";"
              | "{" Block* "}"
              | IfStatement
              | WhileStatement
              | ForStatement
              | TryStatement
              | ReturnStatement
              ;

Declaration   = FunctionDecl
              | InterfaceDecl
              | StructDecl
              | ImportDecl
              ;

Expression    = Ternary ;
Ternary       = LogicalOr ( "?" Expression ":" Expression )? ;
LogicalOr     = LogicalAnd ( "||" LogicalAnd )* ;
LogicalAnd    = Equality ( "&&" Equality )* ;
Equality      = Comparison ( ( "==" | "!=" ) Comparison )* ;
Comparison    = Addition ( ( "<" | "<=" | ">" | ">=" ) Addition )* ;
Addition      = Multiplication ( ( "+" | "-" ) Multiplication )* ;
Multiplication = Unary ( ( "*" | "/" | "%" ) Unary )* ;
Unary         = ( "!" | "-" | "*" | "&" | "await" ) Unary
              | Postfix
              ;
Postfix       = Call ( "[" Expression "]"
                      | "." IDENTIFIER
                      )*
              ;
Call          = Primary ( "(" Arguments? ")" )* ;
Primary       = NUMBER
              | STRING
              | IDENTIFIER
              | "(" Expression ")"
              | "[" Elements? "]"
              | "{" Properties? "}"
              | FunctionLiteral
              | MatchExpression
              ;
```

---

## 타입 시스템

### 원시 타입

```freelang
int             // 정수
float           // 부동소수점
string          // 문자열
bool            // 부울
any             // 동적 타입
void            // 반환값 없음
```

### 복합 타입

```freelang
// 배열
int[]
string[]
T[]

// 객체
{ name: string, age: int }

// 함수 타입
(int, int) => int
async () => Promise<string>

// Union 타입
int | string
Result<T> | Error

// 제네릭
Map<K, V>
Option<T>
```

### 타입 주석

```freelang
var x: int = 42;
fn add(a: int, b: int): int { a + b }
const users: Map<string, User> = new Map();
```

### 제네릭

```freelang
// 함수 제네릭
fn<T> first(arr: T[]): T {
  arr[0]
}

// 구조체 제네릭
struct Box<T> {
  value: T
}

// 제약조건
fn<T: Comparable> max(a: T, b: T): T {
  if (a > b) { a } else { b }
}
```

---

## 표현식

### 산술 연산

```freelang
10 + 5          // 15
10 - 5          // 5
10 * 5          // 50
10 / 5          // 2
10 % 3          // 1
```

### 비교 연산

```freelang
x > 5           // true/false
x >= 5          // true/false
x < 5           // true/false
x <= 5          // true/false
x == 5          // true/false
x != 5          // true/false
```

### 논리 연산

```freelang
true && false   // false
true || false   // true
!true           // false
```

### 할당

```freelang
x = 10
x += 5          // x = x + 5
x -= 3          // x = x - 3
x *= 2          // x = x * 2
x /= 4          // x = x / 4
```

### 배열 접근

```freelang
arr[0]          // 첫 번째 요소
arr[-1]         // 마지막 요소
arr[1..3]       // 슬라이스
```

### 객체 접근

```freelang
obj.property
obj["key"]
obj?.optional   // 선택적 체이닝
```

### 함수 호출

```freelang
fn()
fn(arg1, arg2)
obj.method()
obj.method(a).next()  // 체이닝
```

### 람다 표현식

```freelang
(x) => x * 2
(a, b) => a + b
() => "no args"
```

### 삼항 연산자

```freelang
condition ? value1 : value2
```

### 패턴 매칭

```freelang
match value {
  1 => "one",
  2 => "two",
  _ => "other"
}

match obj {
  { x, y } => x + y,
  _ => 0
}
```

---

## 문장

### 변수 선언

```freelang
var x = 10;
const y = 20;
var z: int = 30;
```

### 조건문

```freelang
if (x > 5) {
  print("greater")
} else if (x < 5) {
  print("less")
} else {
  print("equal")
}
```

### 반복문

```freelang
// while 루프
while (i < 10) {
  i = i + 1
}

// for-in 루프
for x in arr {
  print(x)
}

// for 루프
for i in range(0, 10) {
  print(i)
}

// do-while 루프
do {
  i = i + 1
} while (i < 10)
```

### 제어 흐름

```freelang
break       // 루프 종료
continue    // 다음 반복으로
return x    // 함수에서 반환
throw "error"  // 예외 발생
```

### 블록 스코프

```freelang
{
  var x = 10
  // x는 블록 내에서만 유효
}
// x는 여기서 정의되지 않음
```

---

## 함수

### 함수 선언

```freelang
fn add(a: int, b: int): int {
  a + b
}

fn greet(name: string): void {
  print("Hello, " + name)
}
```

### 기본값 매개변수

```freelang
fn greet(name: string = "World"): void {
  print("Hello, " + name)
}

greet()           // "Hello, World"
greet("Alice")    // "Hello, Alice"
```

### 가변 인자

```freelang
fn sum(...numbers: int[]): int {
  var total = 0
  for n in numbers {
    total = total + n
  }
  total
}

sum(1, 2, 3, 4, 5)  // 15
```

### 화살표 함수

```freelang
var add = (a, b) => a + b;
var square = (x) => x * x;
var greet = () => "Hello";
```

### 고차 함수

```freelang
fn apply(fn: (int) => int, x: int): int {
  fn(x)
}

apply((x) => x * 2, 5)  // 10
```

### 클로저

```freelang
fn makeCounter(): () => int {
  var count = 0
  fn increment(): int {
    count = count + 1
    count
  }
  increment
}

var counter = makeCounter()
counter()  // 1
counter()  // 2
```

---

## 객체 및 구조체

### 객체 리터럴

```freelang
var person = {
  name: "John",
  age: 30,
  email: "john@example.com"
};

person.name         // "John"
person["age"]       // 30
```

### 구조체 정의

```freelang
struct User {
  name: string,
  age: int,
  email: string
}

var user = User {
  name: "John",
  age: 30,
  email: "john@example.com"
};

user.name  // "John"
```

### 인터페이스

```freelang
interface Drawable {
  draw(): void,
  area(): float
}

struct Circle implements Drawable {
  radius: float,

  fn draw(): void {
    print("Drawing circle")
  },

  fn area(): float {
    3.14 * radius * radius
  }
}
```

### 제네릭 구조체

```freelang
struct Box<T> {
  value: T
}

var intBox = Box { value: 42 };
var strBox = Box { value: "hello" };
```

---

## 에러 처리

### Try-Catch

```freelang
try {
  riskyOperation()
} catch (e) {
  print("Error: " + e)
}
```

### Try-Finally

```freelang
try {
  riskyOperation()
} catch (e) {
  print("Error: " + e)
} finally {
  cleanup()
}
```

### 에러 발생

```freelang
throw "error message"
throw CustomError { code: 500 }
```

### Result 타입

```freelang
fn divide(a: int, b: int): Result<int, Error> {
  if (b == 0) {
    Err("Division by zero")
  } else {
    Ok(a / b)
  }
}

match divide(10, 2) {
  Ok(result) => print(result),
  Err(error) => print("Error: " + error)
}
```

---

## 비동기 처리

### Promise

```freelang
var promise = Promise.resolve(42);
var promise2 = Promise.reject("error");
var promise3 = new Promise((resolve, reject) => {
  if (condition) {
    resolve(value)
  } else {
    reject(error)
  }
});
```

### Async/Await

```freelang
async fn fetchUser(id: int): Promise<User> {
  var response = await fetch("/users/" + id);
  var user = await response.json();
  user
}

async fn main(): Promise<void> {
  var user = await fetchUser(1);
  print(user.name)
}
```

### Promise 조합

```freelang
Promise.all([p1, p2, p3])
Promise.race([p1, p2])
Promise.allSettled([p1, p2])
```

---

## 모듈 시스템

### 임포트

```freelang
import "path/to/module"
import "path/to/module" as alias
import { foo, bar } from "module"
import * as utils from "utils"
```

### 익스포트

```freelang
export fn publicFn() { }
export const PUBLIC_CONST = 42
export struct PublicStruct { }
```

### 모듈 구조

```
module/
├── index.fl       // 엔트리 포인트
├── utils.fl       // 유틸리티
├── types.fl       // 타입 정의
└── submodule/
    └── index.fl
```

---

## 표준 라이브러리

### Array 메서드

```freelang
arr.push(element)
arr.pop()
arr.shift()
arr.unshift(element)
arr.map((x) => x * 2)
arr.filter((x) => x > 5)
arr.reduce((acc, x) => acc + x, 0)
arr.find((x) => x.id == 1)
arr.includes(value)
arr.indexOf(value)
arr.slice(0, 5)
arr.join(", ")
```

### String 메서드

```freelang
str.length
str.charAt(index)
str.substring(start, end)
str.slice(start, end)
str.split(",")
str.trim()
str.toUpperCase()
str.toLowerCase()
str.startsWith(prefix)
str.endsWith(suffix)
str.replace(old, new)
str.includes(substring)
```

### Object 메서드

```freelang
Object.keys(obj)
Object.values(obj)
Object.entries(obj)
Object.assign(target, source)
Object.create(proto)
```

### Math 함수

```freelang
Math.abs(x)
Math.floor(x)
Math.ceil(x)
Math.round(x)
Math.max(a, b)
Math.min(a, b)
Math.pow(base, exp)
Math.sqrt(x)
Math.sin(x), Math.cos(x), Math.tan(x)
```

### 타입 검사

```freelang
typeof value     // "number", "string", "object", "function"
instanceof obj   // 타입 검사
Array.isArray(x) // 배열 검사
```

---

## 런타임 특성

### 메모리 관리

- **가비지 컬렉션**: 자동 메모리 해제
- **포인터**: 명시적 메모리 주소 제어
- **참조 카운팅**: 순환 참조 감지

### 동시성

- **Event Loop**: 비블로킹 I/O
- **Worker Threads**: 병렬 실행
- **Mutex**: 동기화 원시

### 성능 특성

| 작업 | 예상 시간 |
|------|---------|
| 렉싱 (1000 ops) | <10ms |
| 파싱 (100 ops) | <20ms |
| 실행 (10000 ops) | <50ms |
| 메모리 (1GB) | <1s 할당 |

---

## 예제

### Hello World

```freelang
print("Hello, World!")
```

### 재귀 함수

```freelang
fn factorial(n: int): int {
  if (n <= 1) {
    1
  } else {
    n * factorial(n - 1)
  }
}

print(factorial(5))  // 120
```

### 비동기 작업

```freelang
async fn fetchAndParse(url: string): Promise<any> {
  var response = await fetch(url)
  var data = await response.json()
  data
}

async fn main(): Promise<void> {
  var users = await fetchAndParse("/api/users")
  for user in users {
    print(user.name)
  }
}
```

### 제네릭 함수

```freelang
fn<T> reverse(arr: T[]): T[] {
  var result: T[] = []
  for i in range(arr.length - 1, -1, -1) {
    result.push(arr[i])
  }
  result
}

print(reverse([1, 2, 3]))        // [3, 2, 1]
print(reverse(["a", "b", "c"]))  // ["c", "b", "a"]
```

### 에러 처리

```freelang
fn safeDiv(a: int, b: int): Result<int, string> {
  if (b == 0) {
    Err("Division by zero")
  } else {
    Ok(a / b)
  }
}

match safeDiv(10, 2) {
  Ok(result) => print("Result: " + result),
  Err(error) => print("Error: " + error)
}
```

---

## 변경 로그

### v9.0.0 (2026-04-04)
- 초기 설계 및 명세 확정
- 모든 핵심 언어 기능 정의
- 표준 라이브러리 목록 완성
- 성능 기준선 설정

---

## 참고

- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)
- [Rust 프로그래밍 언어](https://doc.rust-lang.org/)
- [JavaScript 명세 (ECMAScript 2024)](https://tc39.es/ecma262/)

---

**담당자**: FreeLang 팀
**최종 검토**: 2026-04-04
**상태**: 승인됨 ✅
