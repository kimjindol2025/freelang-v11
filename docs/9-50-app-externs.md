# 9-50 `_app.fl` 외부 호출 x86 지원

## a. 빠진 함수 목록 — 수정 전 기준

이 목록은 구현 전에 확정·커밋한 입력 목록입니다. 기존 `_app.fl` 생성 C/GCC 로그의 `implicit declaration of function` 진단에서 호출명을 추출했습니다. `관련 GCC 오류 수`는 GCC 오류 진단 중 소스 위치 줄에 해당 호출 표현식이 포함된 개수입니다. 한 줄의 여러 진단은 각각 셌으며, 함수 호출이 중첩된 경우 한 진단이 둘 이상의 호출에 포함될 수 있습니다.

| 순위 | 함수 | 관련 GCC 오류 수 |
|---:|---|---:|
| 1 | `http_ok_p` | 18 |
| 2 | `http_post_json` | 11 |
| 3 | `http_get_json` | 7 |
| 4 | `db_one` | 7 |
| 5 | `shell` | 6 |
| 6 | `scrypt_kdf` | 5 |
| 7 | `hmac_sha256` | 5 |
| 8 | `random_bytes` | 4 |
| 9 | `aes_encrypt` | 4 |
| 10 | `aes_decrypt` | 4 |
| 11 | `format_date` | 4 |
| 12 | `http_put` | 3 |
| 13 | `http_post_form` | 3 |
| 14 | `shell_exec_stdout` | 2 |
| 15 | `measure_time` | 2 |
| 16 | `json_str` | 2 |
| 17 | `js_keys` | 2 |
| 18 | `http_head` | 2 |
| 19 | `http_delete` | 2 |
| 20 | `base64_decode` | 2 |
| 21 | `style` | 1 |
| 22 | `server_redirect_cookie` | 1 |
| 23 | `random` | 1 |
| 24 | `base64_encode` | 1 |

수정 전 GCC 기준 기록은 실제 위치 진단 `212`건이며, 과거 느슨한 문자열 grep의 `267`은 문맥 행을 포함한 값입니다. 이 재검증에서는 앞선 GCC 로그와 생성 C를 재사용해 정적 분석했습니다. 단계별 구현 GCC 재측정은 목록 커밋 뒤 각 함수의 회귀 시험 커밋 및 구현 커밋 순서로 진행합니다.

## b. 이번 재검증에서 진행한 구현

`json_str`는 구현 전 시험 실패(`PREIMPLEMENTATION_RC=1`)를 기록한 후 시험을 커밋했고, 기존 `fl_json_stringify`에 위임하도록 구현했습니다. `js_keys`도 같은 순서로 시험·기대 출력을 커밋한 뒤 `fl_map_keys`에 위임했습니다. 보존한 실행 출력은 다음과 같습니다.

```text
JSON_STR={"a":1} REF_EQUAL=1
JS_KEYS_LEN=2 REF_EQUAL=1
```

기존 ARM 실행 결과와의 직접 비교는 하지 않았습니다. 두 시험은 x86 런타임의 기존 동등 함수와 비교합니다.

## c. `_app.fl` GCC 재측정

저장소에 `_app.fl` 원본은 없으며, 이전 작업에서 보존된 생성 C 스냅샷으로만 재측정했습니다. 아래는 그 파일에 현재 런타임 헤더를 적용한 `gcc -fsyntax-only` 결과입니다. 이전 기록의 기준 `212`건과 컴파일 옵션·시점이 동일하다고 증명할 수 없으므로 단계별 감소표로 간주하지 않습니다.

```text
GCC_ERROR_LINES=177
     79 incompatible type for argument 3 of ‘fl_map_set’
     28 lvalue required as left operand of assignment
     25 incompatible type for argument 1 of ‘fl_fn_call’
      4 incompatible types when initializing type ‘enum <anonymous>’ using type ‘FLValue (*)(FLValue,  FLValue)’
      3 ‘_plus’ undeclared (first use in this function)
```

## d–e. 미확인 항목

GCC 통과가 확인되지 않았으므로 앱 실행 및 `/ok` HTTP 200 검증은 하지 않았습니다. `_app.fl` 원본 부재로 함수별 전체 감소 측정 및 오류 0 판정도 미확인입니다. seed·stage2·stage3·stage4의 새 해시, 전체 시험 통과 수, `CGC_SYMBOL 5/5`, `task920 8/8`, strace 하의 금지 실행 파일 0회, 민감 정보 검사 결과 역시 이 재검증에서 실행하지 않았습니다. 따라서 전체 확인 항목을 완료로 표시하지 않습니다.

## X86_SUMMARY

```text
X86_SUMMARY 1/5
```

목록 작성 항목만 완료로 셌습니다. 함수 구현·검증은 일부만 수행되어 나머지 항목은 미확인입니다.

## 커밋 및 원격

이번 작업 커밋: 시험 `ead8f108`, `6e3ba517`; 구현 `3cb0fb24`, `a119f70b`; 보고서 `bfe0c97f`. 보고서 갱신 커밋은 Forgejo를 먼저, GitHub를 다음으로 푸시·확인했습니다. 두 원격 HEAD는 `bfe0c97f7f574be28ec3e191db50b9d0c87d5f68`입니다.
