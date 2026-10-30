# G-2: Forgejo master와 GitHub master 비교

확인 기준: 두 원격 브랜치를 갱신한 뒤 읽기 전용 Git 조회와 merge-tree 계산만 수행했다. master와 작업 브랜치에 병합·푸시하지 않았다. 보고서의 충돌 5건은 Forgejo master와 현재 `v11-x86-seed-public`의 비교 결과다. Forgejo master와 GitHub master끼리의 비교 결과는 별도로 표시했다. 파일명은 저장소 상대 이름이며 절대 경로는 기록하지 않았다. 커밋 제목에 포함된 URL은 `<가림>` 처리했다.

## a. 양쪽 master HEAD와 공통 조상

```text
current comparison branch:
ad25ef8127b87b599df36d23815c97fa2375e3b4 2026-10-29T23:56:05+09:00 docs: record G-1 x86 merge readiness checks
remote branch refs at inspection:
ef20ebc5ab00f768b1a49abc032795c714e05574	refs/heads/master
ad25ef8127b87b599df36d23815c97fa2375e3b4	refs/heads/v11-x86-seed-public
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	refs/heads/master
ad25ef8127b87b599df36d23815c97fa2375e3b4	refs/heads/v11-x86-seed-public
```

```text
git show -s --format="%H %cI %s" forgejo/master
ef20ebc5ab00f768b1a49abc032795c714e05574 2026-06-08T03:14:37+09:00 chore: 서브모듈 제거 (fl-infra 참조 삭제)

git show -s --format="%H %cI %s" origin/master
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4 2026-10-11T20:14:46+09:00 ci: bound optional manual self-host job to 15m [skip ci]

COMMON_ANCESTOR
git merge-base forgejo/master origin/master
b76ddf23491e6bfec8371417ab01b06f00dbd373
b76ddf23491e6bfec8371417ab01b06f00dbd373 2026-06-06T21:26:33+09:00 feat(cgc-bin): x86_64 빌드 완성 — 2 버그 수정

git rev-list --left-right --count forgejo/master...origin/master
20	99
```

## b. 각 master에만 있는 커밋 전체

아래 목록은 공통 조상 이후 해당 master에만 도달 가능한 커밋이다. 각 행은 `해시<TAB>커미터 날짜<TAB>제목`이며, 제목 내 주소는 정책에 따라 `<가림>` 처리했다.

### Forgejo master only

```text
ef20ebc5ab00f768b1a49abc032795c714e05574	2026-06-08T03:14:37+09:00	chore: 서브모듈 제거 (fl-infra 참조 삭제)
9290104dcc3bf768f4a97928f536e3fd43b899bd	2026-06-08T03:09:06+09:00	chore: Gogs 브랜치 인식 강제 갱신
27378215f445690badaeb5dd174c039ea1da93b6	2026-06-08T01:42:25+09:00	chore: ARCHIVED — v11.10.0으로 머지 완료 (2026-06-08)
874bcc3bac4b6ad4189b254761a48da4bb7ef112	2026-06-08T01:18:24+09:00	feat: Phase 113-130 experiments lazy loading (직접 import 제거)
241b7fdd20f34d14f476cc797d45fa5b93bef5fb	2026-06-08T01:06:44+09:00	chore: 빌드 산출물 제거 + gitignore 추가
7af1955d4971595f917d52d4c9db56e2d75fb1f7	2026-06-08T00:59:51+09:00	docs: DEPLOY_GUIDE.md — 번들 구조 + 앱별 배포 조합 + compile 비용 설명
698f29da3e816a3045f48c97e1dbef4105b884ca	2026-06-08T00:58:25+09:00	feat: compile/registry 분리 + compile 구조적 한계 문서화
d72e9b01fa05a0abd43300ad1d70109316161494	2026-06-08T00:55:25+09:00	feat: misc 번들 분해 → 기능별 9개 번들
b35dc8a631e101c4ee25444ee2c9555d654954a8	2026-06-08T00:52:21+09:00	feat: extensions 기능별 번들 분리 5종
d4bce2f9e36b616de3d1e4a885bb90a20ce3b07f	2026-06-08T00:48:15+09:00	feat: 번들 분리 — bootstrap.js + stdlib-extensions.js
3fa45f96a9ed533f4beff133e29a020acaa1abfe	2026-06-08T00:37:06+09:00	feat: Extensions 선택적 로드 - lazy registry 연결
9da7c429fb4f337f15e453f9d0c697e3b1c906e6	2026-06-08T00:22:12+09:00	docs: PHASE 4c 완료 - 상세 spec 문서 4종 작성
2587051c2a3ce03898178e52b6c1d720515b8510	2026-06-08T00:12:18+09:00	feat: PHASE 4 완료 - 5계층 아키텍처 공식 정의 + eval-phase150 정리
f0cacc284a835eeace2d0aabd044c866efdcf972	2026-06-08T00:02:03+09:00	feat: PHASE 3 완료 - 실험 모듈 38개를 src/experiments로 이동
0fa24c4f19b7f867ed2e3aaee1450ea0c4ef1669	2026-06-07T23:54:39+09:00	feat: PHASE 2 시작 - eval-builtins-experiments.ts 분리 (Phase 141-149, 121-130)
fefb4fd8deb9c3c02cece3dee54fe9f12091d3b5	2026-06-07T23:15:43+09:00	Merge branch 'master' of <가림>
842eb496b069e16fa6db707f0da80419d7ce93c4	2026-06-01T00:39:17+09:00	fix: EADDRINUSE 시 process.exit(1) 추가 — PM2 재시작 루프 방지
1ebed7855d9c6b12e0f81a83950373ff5b194d78	2026-05-25T14:19:52+09:00	feat: Self-Host Level-3 Complete (Gates F1-F5 verified, fixed-point achieved)
438e431b869a1b14e6dfa30b4c50b2d6b4c977d8	2026-05-25T14:12:47+09:00	docs: Shadow Phase validation complete (L4 fixed-point verified, gen1-bin 9.8/10)
0686d56919df5d1d5751466804aeeffa1be70ca7	2026-05-25T14:08:19+09:00	fix: cgc-bridge.c stub implementation for user code compilation
```

### GitHub master only

```text
b49cc9194a00649b8cf58e1d6e8ee38ffce770d4	2026-10-11T20:14:46+09:00	ci: bound optional manual self-host job to 15m [skip ci]
dd8ce41b7ef1b3db16b7afa273b38e75227768e5	2026-10-11T20:13:32+09:00	ci: run integration weekly with 15m self-host limit [skip ci]
214ac24474eb811808a069b4f7607d1dc3aa4b73	2026-10-11T20:13:29+09:00	ci: avoid duplicate scheduled and push Slack full suites [skip ci]
3eba7f1def12000e5327265677f3d9a786330fae	2026-10-09T03:24:13Z	fix(stdlib): register helpers and perf modules
d6a9495274d721e5fce1a82b4d88f23bc4027f57	2026-10-08T23:00:16Z	fix(ci): fail on incomplete verification results
a53ce28923bd94fbdd4dbcd00f4576cb1923cb5b	2026-10-08T22:50:12Z	docs(ci): record CI false-green investigation
bbb67c3933198e54be81bd7e259a66cd20002538	2026-10-06T10:56:18Z	fix: stop unbounded tail recursion in CI
6c6a430f004acf5bcf847d32bbffdc5ab7017223	2026-10-06T10:29:36Z	fix: make scheduled CI self-host checks finish reliably
e264c1d0873bd901ef774b143c2eb73f7c78dbd1	2026-09-26T19:09:34+09:00	build: sync backend request limit runtime
23b7c5373243dfd1e3cbfa0ede7afddd0c56f4b7	2026-09-26T19:07:59+09:00	fix: restore complete bootstrap artifact
6624dfa878cf6f60b9480df50c83af5fc4cebae1	2026-09-26T19:06:41+09:00	feat: enforce backend request limits
82037f092a4bc76e7d2f37407b04b125f09eafa5	2026-09-26T16:09:34+09:00	feat: correlate backend requests and logs
030069cd90117704d5879b6d1a15a7e866ff0332	2026-09-26T15:55:36+09:00	feat: migrate legacy backend databases safely
6f68ac14c6febf5b27eb63ed22df33ed79588bca	2026-09-26T14:37:44+09:00	feat: prevent stale concurrent updates
4cc206533f65b69779ca04ae25fbd73c867109dc	2026-09-26T13:34:45+09:00	feat: prevent duplicate backend writes
7d94216cf702b2ea2a3f90774ebb403a36583511	2026-09-26T13:30:47+09:00	feat: enforce backend API error contract
2e5b9f5fcc84802d04d4bec769a7c5baa2fd7dda	2026-09-26T13:25:56+09:00	feat: fail closed on backend proof bearer auth
8072ef4bf5f33267ecde1e776eedacb03b5d3cd3	2026-09-26T13:25:17+09:00	test: prove FreeLang SQLite CRUD persistence
6778e53d59f99d3427fe67da99ec8f1fbd777187	2026-09-26T13:24:31+09:00	test: restore portable fast verification gate
0235180007fe090981a4c91e8168589a29e7c373	2026-09-16T22:55:47Z	feat: add AI-friendly JSON diagnostics and CLI docs
31075c09bce4636fb91986c680b488cb3be5ba9c	2026-09-05T01:06:31Z	feat: add H8-L try throw native codegen
d256826fd1689f0819540d4e1b0303a03e3fd8ac	2026-08-31T11:55:04Z	fix: materialize normal function results
3ef410b32dbb712979632d1e675c41a9a1e51c46	2026-08-31T09:22:43Z	fix: return concrete values from loop user functions
bc613847dadeaa463054979c69b36dafa7998505	2026-08-31T05:51:41Z	test: cover user function argument value kinds
e39e2c2e78d947cb830035f43c7801deedb4a352	2026-08-31T05:50:37Z	fix: eagerly evaluate user function arguments
41a33cdf615c128c928293414ee52d9fbe828fc1	2026-08-30T22:03:17Z	fix: expose binary utf8 metadata to static checker
725e09143a21fc3ee3ae3c94a63d28757f8d9ece	2026-08-29T12:47:04Z	fix: correct fl_fn_call function pointer generation
aa0acbf224f01e489f9e178b6d640914e3333cf2	2026-08-21T11:22:07Z	feat: verify freelang front afj integration
74834c4af4921e951cb44aea3374f18b937257c6	2026-08-21T10:39:26Z	feat: verify freelang afj backend api flow
bf490e7a051f4819e363274fc6cdc019c44dfaec	2026-08-21T09:58:34Z	feat: verify afj db runtime operations
90733ac1f4e72323fe6fa025ba398e4b504b4ab5	2026-08-21T09:14:14Z	fix: stabilize native symbols and higher order parity
db277a8578ae3f1da1ebcb08a5ca75b2832b2686	2026-08-21T05:46:30Z	feat: verify interpreter native parity and evidence
b660028acc1812c23220f793770b37fc024da499	2026-08-21T04:57:54Z	feat: connect fl verify to runtime evidence checks
7dd39553c9ea66d2fe4e1f1753148f14e97aaff8	2026-08-21T04:44:04Z	feat: add project inspect and verify context commands
1ab7a91e72afaf9faf27434761d90ba12448f424	2026-08-17T22:30:55Z	docs: document existing AI and compiler helpers
3f0c0fe7989454fbb5a6a0343a7378d8da541034	2026-08-17T22:12:00Z	docs: record compatibility contract work
63fd39670d3743545948ab3d47974df1823a0a7e	2026-08-17T10:04:42Z	chore: refresh generated example and dependency metadata
76bb6fbbf123e07fa933c80d60ec45e94f61c32b	2026-08-17T09:39:23Z	fix: unify FreeLang compatibility contracts
efa230d7f17f8b361bf1dedccc75e61b6c342fc0	2026-08-16T16:02:26Z	fix: unify FreeLang runtime entrypoint
607d1b4fb6ca4983baad8e736efe1d6d4760c1fb	2026-08-11T21:53:48Z	build: refresh native cgc binary
3fd5670c988cb8f215fc7c5f66a7b2361918ca73	2026-08-11T20:54:49Z	fix: enable native process-run codegen
6d7197cc9617ebc54c0550980e89c6d79f7b8902	2026-08-05T16:02:57Z	feat: add core v1 service example
5ee00c3dea14e5a969aa5183eec8a50d902af6ed	2026-08-05T15:37:19Z	feat: promote core v1 json decode
55f227fcd5e379543e3503e53dfa08ea674ff8bc	2026-08-05T15:31:41Z	docs: prioritize core v1 in ai prompt generator
1e96efe8358d2a3a99a3b9172bf84a38087e5249	2026-08-05T15:27:34Z	docs: harden stdlib core v1 adoption
ddaac197b7364d1f13435b5ed4aca2780e030f2f	2026-08-05T15:12:28Z	feat: add ai stdlib core v1
6cd10ac5705b512fc59045c8e30fe46d197f96b5	2026-07-25T16:54:50+09:00	Merge branch 'master' of <가림>
3d9a3b4630dc87e99a569d47be0ceaa75a184e70	2026-07-25T16:43:43+09:00	fix(http): spawnSync 제거 — 상주 worker로 동기 in-process HTTP
8f92a9468f324b7ef5abed782f15bf6a43b7c618	2026-07-16T01:47:12+09:00	chore: remove stray backup file, refresh generated stdlib signatures after merge
f0d4d4beea11ddd5f6b657d8026eb5f8762519d3	2026-07-16T01:46:45+09:00	merge: sync github history (133 commits ahead)
57cf926223d17259a9027f8f6d3b069903c6b18b	2026-07-16T01:45:51+09:00	wip: pre-merge snapshot before syncing github history
18d542a5be087888df1eeab4d9219197d0af2412	2026-07-07T02:31:21Z	chore: add landing page and refresh project readme for ecosystem profile
96392c4269fdaee948eb2d54a94ac800fa941f88	2026-07-04T11:47:11+09:00	fix: json-parse/json-stringify 컴파일러 stub 버그 수정
f31f4ece45667c749b0851d27331806626244630	2026-07-04T10:39:56+09:00	fix: complete first-class operator native rebuild
05caca4f05bb071270d42597d3793c4d5b03339f	2026-07-04T10:04:18+09:00	Merge origin/master (mariadb charset fix + P1-8 bug4 hoisting)
e844eabb2b77d4f80f82f22ae60035b6a9e0335b	2026-07-04T10:01:05+09:00	feat: native cgc-bin 재생성 — self-hosting L2 고정점 복구 + C타겟 완결 번들
510c24727f96c0ba24bc7b1f0b61ef3d87a620a8	2026-07-04T02:41:03+09:00	fix(stdlib-mariadb): CLI 연결 charset utf8mb4 고정
d57736d47b8be756f1862e313bca576e483c02f9	2026-06-27T10:08:29+09:00	docs: [P1-8] bug4 nested-defn hoisting 완성 블로그 포스팅
32acfc9dd75ca58906029c06014d75285ce43ee3	2026-06-27T10:06:50+09:00	[P1-8] bug4: nested-defn hoisting 완성 (L4 검증)
866998f0de5540dbd18350c89e972e35f51f9383	2026-06-27T10:06:50+09:00	[P1-8] bug4: nested-defn hoisting 설계 구현
bf52e81b1afc6fc025f25917baf59780b282383f	2026-06-21T18:23:05+09:00	Merge remote-tracking branch 'origin/master'
51b6ce66902783a5d345439422ab065d3668a037	2026-06-21T18:22:55+09:00	chore: stdlib 변경 — range 단인자 수정 + http-server 업데이트
5c68b25886b56b7bd742af03efc8bda9e823063d	2026-06-21T06:56:16Z	stdlib: debug-tools.fl VERIFIED (v11+cgc core 5/6, 2026-06-21)
f3832ab2a2b269d714d19c8b30f5aec971448401	2026-06-21T03:37:37Z	stdlib: cache/queue/retry VERIFIED (v11+cgc 2026-06-21)
863f6c0c59613f89d5d57006d095494206e82522	2026-06-21T03:04:49Z	SIS Phase 3 (L3-minimal): subscriber→score→quarantine [v11]
f6f672ad985859e1f627c9a12dcd4bf640fd2d04	2026-06-21T01:34:12Z	SIS Phase 2: E_TIMER_EXCEPTION 인터프리터 런타임 통합
697eb6cf2d74e11f8d13137a545421589c616d24	2026-06-21T03:31:25+09:00	fix: (range n) 단인자 — 0..n-1 반환 (빈 배열 버그 수정)
6772e69d1dc1d49e04d1e70da7aa89bd5de10818	2026-06-21T02:59:04+09:00	feat(sse): v11 SSE 지원 추가 — server_sse/sse_send/sse_broadcast/sse_close/sse_alive/sse_count
c342a37832cd19c43ff31a78ff92b08dcb5e4722	2026-06-21T01:45:09+09:00	chore: cgc-bin 교체 — Phase 3 http-get 맵 반환 반영 (e52da6af)
b098a145360874fdc8cc4318ff78f7d4754763d1	2026-06-20T02:31:13Z	fix(timer): FL-P1 missed-tick observability — set_interval silent-skip 노출 (정식 배포)
e422eccbd26e68c963c33422dbbdf5a29ae318ce	2026-06-16T02:29:34+09:00	refactor: cgc-main.fl을 freelang-v11-fx 레포로 이전
8126c6c07ad6e0576c38440cbf87e3de08965dc2	2026-06-16T02:24:58+09:00	fix: cgc-doseq — get-block-items 패턴으로 바인딩 벡터 추출 수정
96ffbeea0e0649db2a9d083198a036f7e6817e3a	2026-06-15T17:55:02+09:00	feat: fx stdlib 갭 매핑 추가 (sha256/md5/random/max-by/min-by/clamp/json-pretty/file-exists?)
8f4fd2fecdd630a9a946d7312eab4dffb4947b4d	2026-06-15T01:10:52+09:00	feat: cgc-main.fl — defn #line 지시자 + cgc-bin 교체 (18db9db1)
4efb40f5eb3614e5759e982a77e936c81cca71dd	2026-06-15T00:27:48+09:00	fix: cgc-main.fl — expand-loads 순환/중복 load 안전 처리 (정합성 패치)
915c8a33318124f753d258e0769a934a50e9e0a6	2026-06-15T00:00:00+09:00	feat: cgc-main.fl — 문자열 보간/try-catch/정규식/future/HTTPS 5종 완성
b5c1733ece27978aeef900695762f5ae568adb78	2026-06-14T23:03:44+09:00	chore: cgc-bin 업데이트 (gen9 고정점, SHA 6c509bc1)
bfd79643a0c5e92d0b4e6cf57d74af7e4ef2a097	2026-06-14T11:55:30+09:00	feat: for 매크로 추가 + 고정점 달성 (gen9==gen10)
746cfaa8300f630ec153f160ea0856cd6d396517	2026-06-14T11:45:26+09:00	feat: when/unless/case/dotimes/doto 매크로 추가 + case 버그 수정
a5271e9dd69f7de70640787d104ef0db4fc26d79	2026-06-14T11:24:42+09:00	feat: -> / ->> threading macro + cond flat pair + mariadb _p 함수
bb5ee5e7f3e58baac9bf1d389d1aa293dd7ce8cc	2026-06-13T22:48:16+09:00	fix: cgc-main.fl cgc-swap! 닫는 괄호 2개 초과 수정 (1154줄)
668945c0541f1fc442374822805055a909574aaa	2026-06-13T22:15:43+09:00	fix: P0.4 let 바인딩 린터 false positive 수정
6a5a580b5e4530aded6dc65f566e114706fa2472	2026-06-13T21:46:57+09:00	feat: cgc when/unless/for-each 추가 + 2-stage 고정점 달성
09823fc27e1d7bff688d89e4444f73b23022498e	2026-06-13T21:37:06+09:00	fix: cgc-fn 중첩 lambda 번호 충돌 수정 (2-stage 고정점 달성)
92989db62d1e03afae81abcfea6b117a13a76490	2026-06-13T21:27:00+09:00	fix: cgc 3가지 버그 수정 (swap! 람다, and 단락평가, num→fl_num)
7eef72529135e02e50021f01d4048713997f2234	2026-06-13T20:18:48+09:00	feat: throw 에러 라인 추적 + VSCode 확장 + parse-sexpr throw fix
c21ae16fcfae232fc3e4fb57b45ac943f25039a1	2026-06-13T19:37:55+09:00	fix: 4가지 불편함 해소
80ac26838b82d159872744d7a34fcb97343d38f3	2026-06-13T19:24:48+09:00	fix(cgc): closure capture + runtime name conflict
a1ffb83ee9f41a6da15e2ac212171e80d3d79b6e	2026-06-13T18:42:09+09:00	fix: add str-length to interpreter switch case (was missing, CGC had it)
96945dddde3fbcbe0cec714a62d6c87fb83ffd10	2026-06-13T18:36:47+09:00	fix: begin alias for do in cgc-dispatch (3 places) + SQL ROLLBACK verified
7c297305f5936d19fc6b8487f0f9b9d1eaef4c32	2026-06-13T18:18:29+09:00	fix: P0 Closure capture — __apply__ + fl_str_n buffer overflow
58cc59d5118671819011881553db456e83c9a252	2026-06-13T17:47:32+09:00	fix: MariaDB pool 공유버퍼 length→byteLength 수정 (한국어 파라미터 버그)
75773baa899cb81a51a8437de744ed65ff29fe3c	2026-06-13T17:30:53+09:00	feat(cgc): HOF P1 — bare operator + $var 동적 호출 codegen 수정
f3d88815bb2c12177dab3d2d40776b9a8c7a23b9	2026-06-13T17:12:20+09:00	feat(cgc): defn 직접재귀 TCO — goto 루프 자동 변환
cf5229b0eab258face81a8579a34f56eadc2b0cc	2026-06-13T17:03:10+09:00	fix(BUG-2): Fix A + TCO — global defn no closure + direct recursion TCO
4c8bc04913a9d9cf888118534e69636efeee9751	2026-06-13T16:23:31+09:00	feat: cgc-bin — vec-builder / freeze-builder 빌트인 추가
b7d054858d804f30363bd8f3be594db1d662869e	2026-06-13T16:00:18+09:00	fix(cgc): defn 다중 body codegen 버그 수정 — Semantic Corruption P0
e58033dd6785bfbfad0a907e4c854159cbab461f	2026-06-13T15:04:10+09:00	feat: cgc-bin try/catch 코드젠 완성 (Fix 5)
ab57037230b01842e87b7ddacba7bf2bdd6e3f73	2026-06-11T21:21:12+09:00	fix(crypto): dh14-shared — DiffieHellmanGroup에 setPrivateKey 없음 수정 (복구)
```

## c. Forgejo master 대 작업 브랜치 충돌 5건
명령과 원문 충돌 요약:

```text
git merge-tree --write-tree forgejo/master HEAD
MERGE_TREE_RC=1
CONFLICT (content): Merge conflict in .gitignore
CONFLICT (content): Merge conflict in README.md
CONFLICT (add/add): Merge conflict in bootstrap.js
CONFLICT (content): Merge conflict in runtime/cgc-bridge.c
CONFLICT (content): Merge conflict in src/interpreter.ts
```


검증 명령 `git merge-tree --write-tree forgejo/master HEAD`는 종료 코드 1과 아래 충돌 5건을 냈다. `충돌 구간/줄`은 공통 조상을 기준으로 `git merge-file`이 표시한 단일 충돌 구간의 양쪽 내용 줄 수다. add/add는 공통 조상에 파일이 없어서 파일 전체가 충돌이며, 양쪽 파일 줄 수를 적었다.

| 파일 | 유형·충돌 줄(Forgejo / 작업 브랜치) | Forgejo 쪽 내용 요약 | 작업 브랜치 쪽 내용 요약 |
|---|---|---|---|
| `.gitignore` | content, 1구간, 3 / 1 | 빌드 산출물과 ignore 패턴 추가 | `.freelang/` 디렉터리 제외 |
| `README.md` | content, 1구간, 547 / 16 | 5계층 아키텍처와 언어 기능 중심의 상세 README | v11 완료 상태, 고정점 값, 시험·기능 문서 안내 |
| `bootstrap.js` | add/add, 파일 전체, 39930 / 45296 | Phase 분리·lazy loading 후 산출된 bootstrap 번들 | x86 seed 및 현재 compiler/runtime 반영 번들 |
| `runtime/cgc-bridge.c` | content, 1구간, 19 / 23 | 사용자 코드 컴파일용 `lex/parse` stub | `fl_user_lex`·`fl_user_parse` 연결 및 추가 CGC helper |
| `src/interpreter.ts` | content, 1구간, 2 / 22 | builtin 인자를 eager 평가하는 경로 | VM 우선 실행과 TCO 상태를 잠시 끄는 eager 인자 평가 경로 |

위 다섯 파일을 바꾼 분기별 커밋 전체(공통 조상 이후)는 다음과 같다. 행 형식은 `해시<TAB>날짜<TAB>제목`이며 커밋 제목 안 URL은 `<가림>` 처리했다.

### .gitignore — Forgejo master

```text
241b7fdd20f34d14f476cc797d45fa5b93bef5fb	2026-06-08T01:06:44+09:00	chore: 빌드 산출물 제거 + gitignore 추가
```

### .gitignore — v11-x86-seed-public

```text
8fef07ba2efc1a7fd01bfc9bcf837acb04f4c218	2026-10-18T22:48:36+09:00	v11: range/1, variadic max/min, native-compat stdlib, str-to-upper (fixpoint e0eb4960)
```

### README.md — Forgejo master

```text
2587051c2a3ce03898178e52b6c1d720515b8510	2026-06-08T00:12:18+09:00	feat: PHASE 4 완료 - 5계층 아키텍처 공식 정의 + eval-phase150 정리
```

### README.md — v11-x86-seed-public

```text
6b25957a030781da985812e23bebdaffd8d0e3a1	2026-10-23T22:01:42+09:00	fix: preserve seed bootstrap fixed point
5d907ef3deb735cd72c53b6b58b58a8f2bf770e9	2026-10-21T03:07:02+09:00	lib: test/evidence v0.1
74d653857d5c581913770a5ddde16ffb7cb65ded	2026-10-21T01:49:22+09:00	docs: record time fixed point
fe3f84c0a2509e16c20ae5ca79bb1f09ca1a3114	2026-10-20T00:34:06+09:00	docs: record string regex contract and fixpoint history
c95f30122e32ff3faba1fb6f19e6214788bd3000	2026-10-20T00:07:35+09:00	lib: fs v0.1
3ca12e64dfafb8aef3ced5352f2f73e123f33431	2026-10-19T23:44:02+09:00	lib: http v0.1
9abae716e29a76d59d5ee7eab24967f4b32c4657	2026-10-19T23:06:06+09:00	docs: fixpoint and node wording
62827dbf6a9733b8db7fb23e84d9884ccffe36c2	2026-10-19T05:58:55+09:00	docs: v11 complete
1ab7a91e72afaf9faf27434761d90ba12448f424	2026-08-17T22:30:55Z	docs: document existing AI and compiler helpers
5ee00c3dea14e5a969aa5183eec8a50d902af6ed	2026-08-05T15:37:19Z	feat: promote core v1 json decode
18d542a5be087888df1eeab4d9219197d0af2412	2026-07-07T02:31:21Z	chore: add landing page and refresh project readme for ecosystem profile
```

### bootstrap.js — Forgejo master

```text
874bcc3bac4b6ad4189b254761a48da4bb7ef112	2026-06-08T01:18:24+09:00	feat: Phase 113-130 experiments lazy loading (직접 import 제거)
d4bce2f9e36b616de3d1e4a885bb90a20ce3b07f	2026-06-08T00:48:15+09:00	feat: 번들 분리 — bootstrap.js + stdlib-extensions.js
3fa45f96a9ed533f4beff133e29a020acaa1abfe	2026-06-08T00:37:06+09:00	feat: Extensions 선택적 로드 - lazy registry 연결
f0cacc284a835eeace2d0aabd044c866efdcf972	2026-06-08T00:02:03+09:00	feat: PHASE 3 완료 - 실험 모듈 38개를 src/experiments로 이동
0fa24c4f19b7f867ed2e3aaee1450ea0c4ef1669	2026-06-07T23:54:39+09:00	feat: PHASE 2 시작 - eval-builtins-experiments.ts 분리 (Phase 141-149, 121-130)
842eb496b069e16fa6db707f0da80419d7ce93c4	2026-06-01T00:39:17+09:00	fix: EADDRINUSE 시 process.exit(1) 추가 — PM2 재시작 루프 방지
```

### bootstrap.js — v11-x86-seed-public

```text
e264c1d0873bd901ef774b143c2eb73f7c78dbd1	2026-09-26T19:09:34+09:00	build: sync backend request limit runtime
23b7c5373243dfd1e3cbfa0ede7afddd0c56f4b7	2026-09-26T19:07:59+09:00	fix: restore complete bootstrap artifact
6624dfa878cf6f60b9480df50c83af5fc4cebae1	2026-09-26T19:06:41+09:00	feat: enforce backend request limits
0235180007fe090981a4c91e8168589a29e7c373	2026-09-16T22:55:47Z	feat: add AI-friendly JSON diagnostics and CLI docs
d256826fd1689f0819540d4e1b0303a03e3fd8ac	2026-08-31T11:55:04Z	fix: materialize normal function results
3ef410b32dbb712979632d1e675c41a9a1e51c46	2026-08-31T09:22:43Z	fix: return concrete values from loop user functions
e39e2c2e78d947cb830035f43c7801deedb4a352	2026-08-31T05:50:37Z	fix: eagerly evaluate user function arguments
41a33cdf615c128c928293414ee52d9fbe828fc1	2026-08-30T22:03:17Z	fix: expose binary utf8 metadata to static checker
90733ac1f4e72323fe6fa025ba398e4b504b4ab5	2026-08-21T09:14:14Z	fix: stabilize native symbols and higher order parity
76bb6fbbf123e07fa933c80d60ec45e94f61c32b	2026-08-17T09:39:23Z	fix: unify FreeLang compatibility contracts
6cd10ac5705b512fc59045c8e30fe46d197f96b5	2026-07-25T16:54:50+09:00	Merge branch 'master' of <가림>
3d9a3b4630dc87e99a569d47be0ceaa75a184e70	2026-07-25T16:43:43+09:00	fix(http): spawnSync 제거 — 상주 worker로 동기 in-process HTTP
f0d4d4beea11ddd5f6b657d8026eb5f8762519d3	2026-07-16T01:46:45+09:00	merge: sync github history (133 commits ahead)
57cf926223d17259a9027f8f6d3b069903c6b18b	2026-07-16T01:45:51+09:00	wip: pre-merge snapshot before syncing github history
05caca4f05bb071270d42597d3793c4d5b03339f	2026-07-04T10:04:18+09:00	Merge origin/master (mariadb charset fix + P1-8 bug4 hoisting)
e844eabb2b77d4f80f82f22ae60035b6a9e0335b	2026-07-04T10:01:05+09:00	feat: native cgc-bin 재생성 — self-hosting L2 고정점 복구 + C타겟 완결 번들
510c24727f96c0ba24bc7b1f0b61ef3d87a620a8	2026-07-04T02:41:03+09:00	fix(stdlib-mariadb): CLI 연결 charset utf8mb4 고정
bf52e81b1afc6fc025f25917baf59780b282383f	2026-06-21T18:23:05+09:00	Merge remote-tracking branch 'origin/master'
51b6ce66902783a5d345439422ab065d3668a037	2026-06-21T18:22:55+09:00	chore: stdlib 변경 — range 단인자 수정 + http-server 업데이트
863f6c0c59613f89d5d57006d095494206e82522	2026-06-21T03:04:49Z	SIS Phase 3 (L3-minimal): subscriber→score→quarantine [v11]
f6f672ad985859e1f627c9a12dcd4bf640fd2d04	2026-06-21T01:34:12Z	SIS Phase 2: E_TIMER_EXCEPTION 인터프리터 런타임 통합
697eb6cf2d74e11f8d13137a545421589c616d24	2026-06-21T03:31:25+09:00	fix: (range n) 단인자 — 0..n-1 반환 (빈 배열 버그 수정)
6772e69d1dc1d49e04d1e70da7aa89bd5de10818	2026-06-21T02:59:04+09:00	feat(sse): v11 SSE 지원 추가 — server_sse/sse_send/sse_broadcast/sse_close/sse_alive/sse_count
b098a145360874fdc8cc4318ff78f7d4754763d1	2026-06-20T02:31:13Z	fix(timer): FL-P1 missed-tick observability — set_interval silent-skip 노출 (정식 배포)
c21ae16fcfae232fc3e4fb57b45ac943f25039a1	2026-06-13T19:37:55+09:00	fix: 4가지 불편함 해소
a1ffb83ee9f41a6da15e2ac212171e80d3d79b6e	2026-06-13T18:42:09+09:00	fix: add str-length to interpreter switch case (was missing, CGC had it)
58cc59d5118671819011881553db456e83c9a252	2026-06-13T17:47:32+09:00	fix: MariaDB pool 공유버퍼 length→byteLength 수정 (한국어 파라미터 버그)
cf5229b0eab258face81a8579a34f56eadc2b0cc	2026-06-13T17:03:10+09:00	fix(BUG-2): Fix A + TCO — global defn no closure + direct recursion TCO
ab57037230b01842e87b7ddacba7bf2bdd6e3f73	2026-06-11T21:21:12+09:00	fix(crypto): dh14-shared — DiffieHellmanGroup에 setPrivateKey 없음 수정 (복구)
```

### runtime/cgc-bridge.c — Forgejo master

```text
0686d56919df5d1d5751466804aeeffa1be70ca7	2026-05-25T14:08:19+09:00	fix: cgc-bridge.c stub implementation for user code compilation
```

### runtime/cgc-bridge.c — v11-x86-seed-public

```text
fc889b8778ac4310c7a29e330124e9ac0ea3a38b	2026-10-18T17:27:13+09:00	feat(v11): expand self-host runtime support
dec63e636a2b1225ba88b8d9b9e3a426e129f6f2	2026-10-15T20:28:40+09:00	v11: x86 seed from self-built translator, fixpoint 2=3=4
90733ac1f4e72323fe6fa025ba398e4b504b4ab5	2026-08-21T09:14:14Z	fix: stabilize native symbols and higher order parity
e58033dd6785bfbfad0a907e4c854159cbab461f	2026-06-13T15:04:10+09:00	feat: cgc-bin try/catch 코드젠 완성 (Fix 5)
```

### src/interpreter.ts — Forgejo master

```text
0fa24c4f19b7f867ed2e3aaee1450ea0c4ef1669	2026-06-07T23:54:39+09:00	feat: PHASE 2 시작 - eval-builtins-experiments.ts 분리 (Phase 141-149, 121-130)
```

### src/interpreter.ts — v11-x86-seed-public

```text
e39e2c2e78d947cb830035f43c7801deedb4a352	2026-08-31T05:50:37Z	fix: eagerly evaluate user function arguments
76bb6fbbf123e07fa933c80d60ec45e94f61c32b	2026-08-17T09:39:23Z	fix: unify FreeLang compatibility contracts
```

## Forgejo master 대 GitHub master 충돌
명령과 원문 충돌 요약:

```text
git merge-tree --write-tree forgejo/master origin/master
MERGE_TREE_RC=1
CONFLICT (content): Merge conflict in README.md
CONFLICT (add/add): Merge conflict in bootstrap.js
CONFLICT (content): Merge conflict in runtime/cgc-bridge.c
CONFLICT (content): Merge conflict in src/interpreter.ts
```


현재 원격 master 둘을 직접 비교한 `git merge-tree --write-tree forgejo/master origin/master` 결과는 종료 코드 1이며 충돌은 4건이다. `.gitignore`는 충돌하지 않는다. 이는 위의 Forgejo master 대 작업 브랜치 충돌 5건과 다른 비교쌍이다.

```text
CONFLICT (content): Merge conflict in README.md
CONFLICT (add/add): Merge conflict in bootstrap.js
CONFLICT (content): Merge conflict in runtime/cgc-bridge.c
CONFLICT (content): Merge conflict in src/interpreter.ts
```

merge-file 충돌 구간은 README.md 1구간(Forgejo 21줄 / GitHub 2줄), runtime/cgc-bridge.c 1구간(19줄 / 22줄), src/interpreter.ts 1구간(2줄 / 22줄)이다. bootstrap.js는 공통 조상에 없고 add/add이며, 전체 파일은 Forgejo 39930줄, GitHub 45296줄이다. README의 Forgejo 쪽은 5계층 아키텍처 설명, GitHub 쪽은 저장소 요약 문장이다. cgc-bridge는 Forgejo 쪽이 사용자 코드용 stub, GitHub 쪽이 parser 제공 함수 연결과 CGC helper다. interpreter는 Forgejo 쪽이 eager argument 평가, GitHub 쪽은 VM 시도와 TCO 상태 제어를 포함한다.

## d. 판단 자료 (결정 아님)

- 더 최신인 tip은 GitHub master다. tip 날짜는 GitHub `2026-10-11T20:14:46Z`, Forgejo `2026-06-08T03:14:37+09:00`이며, 공통 조상 이후 GitHub에만 있는 커밋은 99개, Forgejo에만 있는 커밋은 20개다.
- GitHub master에는 backend 요청 제한, 데이터베이스 동시 갱신, CI 안정화, interpreter/runtime 보완 등 공통 조상 이후의 후속 변경이 더 많이 들어 있다. 이는 더 최신이라는 근거이지, 완전성의 확정 증거는 아니다.
- Forgejo master에는 실험 코드 분리, lazy-loading, 번들 구조 변경이 있으며 이 커밋들은 GitHub master 고유 이력에 없다. 반대로 GitHub 쪽에도 Forgejo에 없는 후속 backend·runtime·CI 커밋이 있다.
- 따라서 커밋 시점과 수 기준으로 GitHub가 최신이다. “더 완전한 master”는 양쪽 고유 변경의 기능·배포 요구사항을 대조하지 않았으므로 판정 보류한다. 어느 쪽을 합칠 기준으로 삼을지 결정하지 않는다.

## e. 민감 정보 검사와 작업 범위

```text
SENSITIVE_SCAN_MATCHES=0
ABSOLUTE_PATHS_RECORDED=0
SERVER_URLS_RECORDED=0
KEY_MATERIAL_RECORDED=0
MASTER_MERGE_PERFORMED=0
MASTER_PUSH_PERFORMED=0
```

주소·절대 경로·키 패턴의 자동 검사를 실행했고 결과는 아래에 기록한다. 경로 문자열은 저장소 상대 파일명 외에는 기록하지 않았다.


민감정보 검사 결과: 절대 경로 0건, 서버 주소 0건, 키·토큰 패턴 0건.
```text
ABSOLUTE_PATH_MATCHES=0
SERVER_ADDRESS_MATCHES=0
KEY_OR_TOKEN_MATCHES=0
```
