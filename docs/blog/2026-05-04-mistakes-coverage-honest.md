# 정직 점검: "25개 처리" → 실측 14, ALIAS 확장 후 33

**2026-05-04** · 같은 날 세 번째 글. 오전 자평 다음에는 *카운트 자체가 정직하지 않았다는* 점검.

---

## 발단

블로그 후속편(`freelang-smart` wrapper) 끝에 사용자가 물었다.

> "우선 미스테이크 얼마나 적용했나 체크"

오전 글에 *"25개 자동 처리"* 라고 썼다. 기억하기로:
- ALIAS 25개 등록
- smart-* 헬퍼 4개
- HTTP 래퍼 3개
- try-call 2개

→ 그래서 25 라고 자연스럽게 썼는데, **MISTAKES-100 항목과의 직접 매핑** 기준으로 다시 세보면 다르다.

---

## 실측 1차: 14/100

| 분류 | 개수 |
|-----|------|
| Wrapper 자동 (코드 그대로 동작) | 6 |
| 옵션 헬퍼 (smart-*, http-*-json) | 8 |
| **MISTAKES-100 직접 매핑** | **14** |

오전 글의 25는 "ALIAS에 등록한 함수 수"였지, "100선 매핑 수"가 아니었다.
ALIAS에 `push → append`를 등록했지만, MISTAKES-100에 `push`는 없다.
ALIAS 수와 100선 매핑 수는 별개.

→ 표기 수정 필요.

---

## 분리: `_aliases.json` 단일 소스

수정 전엔 ALIAS 데이터가 두 곳에 복제돼 있었다.
- `bin/freelang-smart` (wrapper)
- `src/stdlib-helpers.ts` (Phase G 모듈)

내용이 약간 달랐다 (wrapper에 25개, helpers에 28개 — 동기화 누락).

```
src/_aliases.json     ← 단일 소스
   ├─ wrapper가 require
   └─ helpers가 import (resolveJsonModule: true)
```

각 ALIAS에 `mistake` 필드를 추가:
```json
{
  "console.log": { "correct": "println", "usage": "(println value)", "mistake": "#35" }
}
```

이제 `verify-mistakes-coverage.js` 스크립트가 `_aliases.json`을 스캔해서
"이 ALIAS가 100선 어느 항목과 매핑되는지" 자동 카운트.

---

## ALIAS 확장 22개

100선의 *함수명 오류* (Cat 6, 14개)는 모두 ALIAS로 처리 가능.
*문자열* (Cat 12, 7개)도 거의 모두.
이걸 추가:

```
+ #32 env / get_env / env_get → shell_env
+ #36 json_keys / object_keys → keys
+ #37 now-ms / Date.now / current_time_ms → now_ms
+ #38 mariadb_all / db_query → mariadb_query
+ #39 obj_merge / merge → assoc
+ #40 obj_omit / omit → dissoc
+ #41 obj_pick → get
+ #42 count / size → length
+ #43 split / str_split → str-split
+ #44 JSON.parse / parse_json → json_parse
+ #45 JSON.stringify / stringify → json_stringify
+ #57 num_to_str → str
+ #77 str_length → str-length
+ #78 trim → str-trim
+ #79 starts-with? / ends-with? → str-starts-with / str-ends-with
+ #80 includes → str-contains
+ #81 to-upper / to-lower → str-upper / str-lower
+ #82 toString / to_string / to_str → str
+ #90 throw → error
```

22개 추가 → 합계 50+ ALIAS, 100선 매핑 23개로 늘어남.

---

## 실측 2차: 33/100

```
Cat 1 인자 순서      4/10 ████░░░░░░ 40%
Cat 2 HTTP 응답      4/5  ████████░░ 80%
Cat 3 atom           0/5  ░░░░░░░░░░ 0%
Cat 4 let            1/5  ██░░░░░░░░ 20%
Cat 5 함수 선언      1/6  ██░░░░░░░░ 17%
Cat 6 함수명 오류   14/14 ██████████ 100%
Cat 7 HTTP 서버      0/9  ░░░░░░░░░░ 0%
Cat 8 데이터 타입    2/6  ███░░░░░░░ 33%
Cat 9 조건문         0/5  ░░░░░░░░░░ 0%
Cat 10 DB            0/5  ░░░░░░░░░░ 0%
Cat 11 파일/환경     0/5  ░░░░░░░░░░ 0%
Cat 12 문자열        6/7  █████████░ 86%
Cat 13 배열          0/6  ░░░░░░░░░░ 0%
Cat 14 에러 처리     1/4  ███░░░░░░░ 25%
Cat 15 기타          0/8  ░░░░░░░░░░ 0%
─────────────────────────────────
총합               33/100 = 33%
```

---

## Caveat (정직 추가)

**33은 "처리 가능한 매핑이 등록된 수"**. 실제로 사용자가 도움받는 수는 더 적다.

- ALIAS 등록 항목 23개 중 일부는 **실제로 작동하는 함수**라서 hint가 트리거되지 않는다.
  - 예: `(json_keys m)` — 100선은 *없는 함수*라고 했지만, 실제로 작동.
        ALIAS 매핑은 등록되어 있어도 트리거 안 됨 (정상 실행).
  - 예: `(trim "  x  ")` — 동일.
- 옵션 헬퍼 8개는 사용자가 *접두사 알고 호출*해야 동작.
- 진짜 *코드 수정 없이 동작*하는 wrapper 자동 = **2개** (#23 let, #26 [FUNC])

> **솔직 평가**: "33% 처리"라기보다 "33개에 매핑이 있다". 진짜 trigger되는 케이스는
> 사용자가 잘못된 함수명을 적었을 때. 그게 가장 흔한 실수이긴 함.

---

## 다음 단계 (Phase H)

남은 67개 분석:

| 카테고리 | 미처리 | 처리 방법 |
|---------|-------|----------|
| Cat 1 (#3, 4, 6, 7, 8, 10) | 6개 | smart-reduce/sort-by/dissoc/str-* 추가 |
| Cat 3 atom | 5개 | 타입 시스템 (런타임 검증) |
| Cat 5 함수 선언 | 5개 | $ 누락 검사 (파서 또는 wrapper) |
| Cat 7 HTTP 서버 | 9개 | 핸들러 시그니처 ALIAS + hint |
| Cat 9 조건문 | 5개 | 패턴 감지 (어려움) |
| Cat 10 DB | 5개 | mariadb_connect 시그니처 검증 |
| Cat 11 파일/환경 | 5개 | env_load 자동 + hint |
| Cat 13 배열 | 6개 | append 불변 hint |
| Cat 14 에러 | 3개 | try-catch 완전 구현 |
| Cat 15 기타 | 8개 | server_start 블로킹 hint 등 |

쉬운 것부터: **Cat 1 잔여 6개 + Cat 11 5개 = 11개** 추가 가능.
그러면 33 → 44 (44%) 달성 가능.

---

## 한 줄 정리 (오전·오후 통합)

> 오전: "언어가 자신을 방어한다" (과장)
> 오후: wrapper로 진짜 자동 hint (6개 자동, 25 ALIAS) — *반쯤* 사실
> 실측: ALIAS 확장 후 33/100 매핑 (실제 trigger는 더 적음) — 정직
>
> "**33%**"라고 말할 때, 그 33% 안에서도 *진짜 자동*은 2개고, 나머지는 *함수 미존재 시 hint*다.
>
> v11.5.0에서는 그 33% 안에 caveat 없는 진짜 자동을 늘리는 게 목표.

**도구**: `node scripts/verify-mistakes-coverage.js` 실행하면 항상 최신 카운트 확인 가능.
**커밋**: 다음 커밋에서 v11.4.2 태그
