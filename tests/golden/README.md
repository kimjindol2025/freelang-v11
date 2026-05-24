# Golden Test Reference Files

이 디렉토리에는 FreeLang 컴파일러 코드 생성(codegen) 기준 파일이 저장됩니다.

## 파일 구조

```
hello.expected.c       — hello.fl → C 코드 생성 기준
recur.expected.c       — 재귀/TCO → C 코드 생성 기준
closure.expected.c     — 클로저 캡처 → C 코드 생성 기준
hof.expected.c         — map/filter/reduce → C 코드 생성 기준
self.expected.c        — cgc-main.fl 자가 생성 기준
```

## Golden Test 기준 파일 생성

새로운 golden 기준 파일을 추가하려면:

```bash
# 1. FL 소스 코드 작성
cat > tests/e2e/hello.fl << 'EOF'
(println "Hello, world!")
EOF

# 2. cgc-native로 C 코드 생성
cgc-native tests/e2e/hello.fl /tmp/hello-gen.c

# 3. 기준 파일로 저장
cp /tmp/hello-gen.c tests/golden/hello.expected.c

# 4. git에 추가
git add tests/golden/hello.expected.c
```

## SHA256 검증

Golden test는 SHA256 해시로 비교됩니다. 공백/줄바꿈까지 완전히 일치해야 합니다.

```bash
# 기준 파일 SHA256 확인
sha256sum tests/golden/hello.expected.c

# 생성 파일 SHA256 확인
cgc-native tests/e2e/hello.fl /tmp/hello-gen.c
sha256sum /tmp/hello-gen.c

# 일치 확인
diff tests/golden/hello.expected.c /tmp/hello-gen.c  # 없어야 함
```

## Golden 파일 갱신

컴파일러 코드 생성 로직을 변경한 경우:

```bash
# 1. 변경 커밋 (메시지에 이유 기록)
git commit -m "opt: emit-let 최적화 — 불필요 변수 선언 제거"

# 2. Golden 파일 자동 갱신 (다음 구현)
./test.sh update-golden hello

# 3. 변경 검토
git diff tests/golden/hello.expected.c

# 4. 커밋
git add tests/golden/hello.expected.c
git commit -m "test: update golden for hello optimization"
```

---

**상태**: 스켈레톤 (실제 파일은 Phase 1B에서 추가)  
**다음**: cgc-native 실행 후 기준 파일 생성
