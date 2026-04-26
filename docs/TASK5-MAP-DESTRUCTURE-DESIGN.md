# Task #5: Map 구조분해 패턴 (설계)

## 문제

현재 match에서 map 패턴을 지원하지 않아, 구조화된 데이터 처리가 번거움:

```fl
;; ❌ 미지원
(match resp
  [{:status "ok" :data $d} (handle-ok $d)])

;; ✅ 현재 방식 (번거로움)
(let [[s (get resp :status)]
      [d (get resp :data)]]
  (match s
    ["ok" (handle-ok $d)]))
```

## 목표

map 패턴을 match에서 직접 지원하여, 복잡한 구조화 데이터를 간결하게 처리:

```fl
;; ✅ 목표 형식
(match resp
  [{:status "ok" :data $d} (handle-ok $d)]
  [{:status "error" :msg $e} (handle-error $e)]
  [default "unknown"])
```

## 구현 범위

### 1. 파서 강화 (self/parser.fl)

**현재**: pattern은 literal 또는 variable만 지원
```fl
pattern := literal | variable | "default"
```

**목표**: map-pattern 추가
```fl
pattern := literal | variable | map-pattern | "default"
map-pattern := "{" {":key" pattern ...} "}"
```

### 2. AST 확장

현재 AST:
```js
{
  kind: "pattern-match",
  value: <expr>,
  cases: [
    { pattern: <literal|variable>, body: <expr> }
  ]
}
```

확장 후:
```js
{
  kind: "pattern-match",
  value: <expr>,
  cases: [
    {
      pattern: {
        kind: "map-pattern",
        fields: { ":key": <pattern>, ... }
      },
      body: <expr>
    }
  ]
}
```

### 3. 코드생성 (self/codegen.fl)

**전략**: map-pattern을 JavaScript 조건문으로 컴파일

입력:
```fl
(match resp
  [{:status "ok" :data $d} (handle-ok $d)])
```

출력:
```js
if (resp !== null && typeof resp === "object" && !Array.isArray(resp)) {
  const _status = resp["status"];
  if (_status === "ok") {
    const $d = resp["data"];
    return handleOk($d);
  }
}
```

## 구현 단계

### Step 1: 파서 강화
- self/parser.fl의 `parse-atom` 함수에서 map literal 처리 수정
- map-pattern vs map-literal 구분 (컨텍스트 기반)

### Step 2: AST 일관성
- interpreter.ts에서 map-pattern 핸들링 추가
- evalPatternMatch에서 map-pattern 케이스 처리

### Step 3: 코드생성
- self/codegen.fl에서 `cg-pattern-match`에 map-pattern 지원 추가
- 임시 변수 생성 (_$key) 및 바인딩

## 예상 복잡도

- **파서**: 중간 (map literal 처리와 유사)
- **인터프리터**: 낮음 (eval-pattern-match 수정)
- **코드생성**: 높음 (임시 변수 관리, 중첩 패턴 처리)

## 우려사항

1. **중첩 패턴**: `{:data {:id $id}}` 같은 깊은 중첩
   - 단계별 확장 가능 (v1: 단일 레벨만 지원)

2. **성능**: 런타임 패턴 매칭의 성능 영향
   - 코드생성으로 최적화 (런타임 검사 최소화)

3. **하위호환**: 기존 코드 영향 없음
   - 새로운 문법, 기존 match는 불변

## 타이밍

- **예상 소요**: 2~3일
- **우선순위**: Task #4 완료 후 (에러 디버깅이 유용)
- **배포**: verify-all 통과 확인 후

---

**상태**: 설계 단계, 대기 (Task #4 완료 대기)
