# 9-50 `_app.fl` 외부 호출 x86 지원

## a. 빠진 함수 목록 — 수정 전 기준

이 목록은 구현 전에 확정·커밋한 입력 목록입니다. 기존 `_app.fl` 생성 C/GCC 로그의 `implicit declaration of function` 진단에서 호출명을 추출했습니다. `관련 GCC 오류 수`는 GCC 오류 진단 중 소스 위치 줄에 해당 호출 표현식이 포함된 개수입니다. 한 줄의 여러 진단은 각각 셌으며, 함수 호출이 중첩된 경우 한 진단이 둘 이상의 호출에 포함될 수 있습니다.

```text
function             related GCC errors
http_ok_p             18
http_post_json        11
shell                  6
scrypt_kdf             5
hmac_sha256            5
random_bytes           4
aes_encrypt            4
aes_decrypt            4
format_date             4
http_put                3
http_post_form          3
shell_exec_stdout       2
measure_time            2
json_str                2
js_keys                 2
http_head               2
http_get_json           7
http_delete             2
base64_decode           2
style                   1
server_redirect_cookie 1
random                  1
db_one                  7
base64_encode           1
```

위 정렬 순서는 임시 산출물 기록 과정의 입력 순서이며 오류 수 기준 정렬이 아니므로, 아래 표를 오류 수 내림차순 기준으로 사용합니다.

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

## b–e. 구현 및 검증 기록

아직 실행하지 않았습니다. 각 함수의 회귀 시험과 기대 출력 커밋 후 구현하고, 기존 ARM/FreeLang 결과 비교, 단계별 GCC 오류 수, `/ok`, seed 고정점, 전체 시험 및 별도 exec 추적 결과를 여기에 원문으로 누적합니다.

## 커밋 및 원격

함수 목록만 먼저 커밋합니다. Forgejo 및 GitHub 푸시와 HEAD 확인은 구현·검증 후 기록합니다.
