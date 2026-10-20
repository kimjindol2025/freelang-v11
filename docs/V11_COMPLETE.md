# FreeLang v11 완료 기록

- 고정점: stage 2 = stage 3 = stage 4, `8b116c9e025517dbb6bf70a5629bf4172533fde3289b98c13674166148c0bd1c`
- 고정점 변경 이유: TASK 9-11 loopback 서버 소켓 5개를 실제 네이티브 진입점에 연결. 씨앗은 유지.
- 시드 SHA-256: `36a806b0aa9639ce34c4b5c3d04807944db9df3bfec3ae4e4780f22e8428edb2`
- 실행 경로에 Node 0 / JS 0 / AFJ 0, 옛 파일은 `legacy/`에 보관.
- 측정 도구 SHA-256: `fed5fa7db902e6eb1e72d0215ca76c31dc6da37ae110e89c565df1a4530618ca`
- 검증: 전체 시험 41/41, 감사 44/44, v11 단위시험 4/4, E2E 4/4, DB 10/10, HTTP 6/6

## 고정점 이력 (TASK 9-7, git log / git show 대조)

해시는 커밋 ID가 아니라 stage2·3·4 생성 C 파일의 SHA-256이다.

| 고정점 SHA-256 | 변경 커밋 | 변경 이유 |
|---|---|---|
| `dd5528735a6a2beb16aea40b7b09954817caa2e39b25b91b78c1e1c545f7ee3f` | `58b87d03` + `76beea62` (기록 갱신 `9abae716`) | char-from-byte 코드 생성, 로드된 JSON API 우선 호출 및 FUNC 전방 선언 반영 |
| `bd271beee58ebeadf123907d3469cd158546f44142c2af734bcff02acc3f236e` | `3ca12e64` | HTTP 공개 함수 우선 호출과 http-get C 심볼 분리 |
| `3018a00633794c56ba2544db36f2f866446c55cf3c82f5605691690dfffe6d94` | `c95f3012` | FS 공개 함수 우선 호출과 dir-list C 심볼 분리, 모듈 없는 기존 내장 호출 유지 |
| `b530b16ddf8f8cb2450686976a874d869ff919a153cb6b1f2ab13a7662333567` | `cf5d682c` (`lib: str and regex v0.1`) | 문자열 API 우선 호출·내부 기본 함수·C 심볼 분리, 정규화한 모듈 경로의 중복 확장 방지 |
| `3db27042fe5c2d7c4cc60229f171667cfc81d9455b2d9a62ffd5c468d81e9a14` | `6c577f12` (`lib: time v0.1`) | now-iso 라이브러리 API를 우선 연결하고 기존 C 심볼과 분리; 모듈 없는 기존 내장 호출은 유지 |
| `cb61631e3ac0ed993e9aadc399ecddffa560219698fd68f376326de163f2a6b6` | TASK 9-8 (`lib: test/evidence v0.1`) | 시험 프로세스 격리와 종료 기본 함수를 실제 네이티브 진입점에 연결 |
| `cb61631e3ac0ed993e9aadc399ecddffa560219698fd68f376326de163f2a6b6` | TASK 9-9 (`test: fl runner, C minimal audit`) | C 최소 추가 근거 점검과 시험 감독 실행기의 FreeLang 전환; C·컴파일러 변경 없이 씨앗 부트스트랩 후 stage2·3·4 일치 재확인 |
| `cb61631e3ac0ed993e9aadc399ecddffa560219698fd68f376326de163f2a6b6` | TASK 9-10 (`test: all runners in fl`) — 부분 완료 | 시간·문자열/정규식·FS 실행기 FreeLang 전환; 기존 stage2·3·4 해시와 cmp 재확인. C·컴파일러·씨앗 변경 없음. HTTP bind 전용 소켓 API 부재로 해당 실행기는 BLOCKED·Python 보존; 전체 Python 0회 미달성 |
| `8b116c9e025517dbb6bf70a5629bf4172533fde3289b98c13674166148c0bd1c` | TASK 9-11 (`runtime: tcp listen, test: http runner in fl`) — 부분 완료 | tcp-bind/listen/accept/close/local-port와 FreeLang HTTP 실행기. 새 부트스트랩 stage2·3·4 일치, cmp 두 건 0. http-serve-once는 기존 HTTP 내부 static I/O 함수의 FreeLang 노출 여부 결정 대기(BLOCKED); 새 읽기·쓰기 구현은 추가하지 않음 |

`git log -- self/cgc-main.fl docs/V11_COMPLETE.md`와 각 커밋의 실제 차이를
대조했다. `dd552873…`의 기록 갱신 커밋 자체는 컴파일러 변경 커밋이 아니다.
TASK 9-6은 보존한 씨앗으로 현재 컴파일러를 부트스트랩한 뒤 stage2·3·4를
만들어 SHA-256 일치와 두 CMP 종료값 0을 확인했다. 런타임 씨앗 교체는 없다.

## TASK 9-6 검증

TASK 9-6 검증: 문자열 35/35, 정규식 67/67, 기존 문자열 내장 6/6,
모듈 통합 4/4, 기존 41/41, 감사 44/44, 8영역·HTTP·FS 통과.
완료된 두 execve 추적에서 Node 0·JS 0. 심층 검증 TRUSTED/종료값 0.
기존 AFJ 전용 capability probe의 PARTIAL 제한은 전체 기능 검증 완료로 해석하지 않는다.

## 남은 사항

- `legacy/`에는 사용하지 않는 옛 JS 도구가 보관되어 있습니다.
- 도구 저장소에는 프로젝트 설정에 따라 실행되는 선택 경로 npm 호출 3줄이 남아 있습니다.
- `fl-repl`과 `fl-serve`는 네이티브 런타임에서 아직 지원되지 않습니다.

## TASK 9-7 검증

날짜·시간 61/61, 기존 시간 내장 2/2, Python 표준 날짜 계산 대조 360/360.
기존 41/41·감사 44/44·8영역·HTTP·FS·문자열·정규식 통과.
보존한 씨앗에서 부트스트랩한 stage2·3·4 SHA-256 일치, 두 cmp 종료값 0.
현재 고정점으로 도구 추적 컴파일러 갱신, 현재 런타임으로 레지스트리를 tr.c 이름으로 재빌드해 일치 확인.
실행 추적 Node·JS 0, 기존 미추적 57개 목록·내용 해시 유지.
stopwatch는 기존 실시간 시계 기반이며 단조 시계가 아니다. 지역 이름 시간대·DST·윤초는 미지원.

## TASK 9-8 검증

시험·실행 증거 계약 53/53, test-report의 실제 종료값 0/1과 실패 상세 확인.
예외·치명 오류·조기 exit·signal·10초 제한 이후 다음 시험의 계속 실행을 검증했다.
독립 sha256sum 대조, 가림·JSON 원자 쓰기·실패 뒤 복구를 확인했다.
기존 41/41, 이번 실행에서 완료된 감사 44/44와 기존 라이브러리 시험 통과.
씨앗 유지, stage2·3·4 SHA-256 일치와 두 cmp 종료값 0.
도구 추적 컴파일러·레지스트리는 현재 코드와 런타임으로 재빌드했다.
도구 저장소의 기존 미추적 57개는 목록·내용 해시를 유지했다.

## TASK 9-9 검증

C 최소 추가 목록과 OS 경계 근거를 계약 문서에 기록했다. C·컴파일러는 변경하지 않았다.
시험 감독 실행기를 FreeLang으로 전환하고 test-run/evidence-run을 재사용했다.
Python/FreeLang 실행기 모두 새 시험 53/53, 보고 사례 종료 0·0·1, 실행기 종료 0이며
원본 표준출력 cmp 종료 0을 확인한 후 기존 Python 실행기를 삭제했다.
기존 41/41, 감사 44/44, 전체 라이브러리 재시험과 심층 검증 TRUSTED/종료 0 통과.
완료된 execve 감시에서 새 실행기는 node/npm/npx/.js/python 각각 0회다.
전체 라이브러리·기존 시험·심층 검증은 node/npm/npx/.js 각각 0회, python 4회다.
이는 이번에 수정하지 않은 기존 Python 라이브러리 실행기 네 개의 실행이다.
씨앗 유지, 부트스트랩 후 stage2·3·4 동일 해시와 cmp 두 건 0,
도구 저장소 기존 미추적 57개 목록·내용 해시 보존을 확인했다.
AFJ 전용 capability probe의 PARTIAL 제한은 그대로 남는다.
