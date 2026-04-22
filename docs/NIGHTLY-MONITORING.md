# Nightly Monitoring & Alert 설정

## 개요

매일 02:00 UTC에 자동으로 실행되는 `nightly-self-host` job을 모니터링하고 알림을 설정합니다.

## 1단계: 모니터링 대시보드 설정

### GitHub Actions 대시보드

1. 저장소 → **Actions** 탭
2. 좌측 메뉴: "Phase C" workflow 클릭
3. **Schedule** 이벤트 필터 선택
4. 최근 nightly run들 목록 확인

**정기 확인 체크리스트:**

- [ ] 매일 아침(또는 업무 시작 시) nightly run 확인
- [ ] 빨간색(실패) 표시 발견 시 즉시 Slack/이메일 알림
- [ ] Artifact 다운로드 (실패 시)
- [ ] 로그 분석 및 이슈 생성

### Slack에서 자동 알림 수신

현재 설정: `phase-c-full-slack.yml` nightly-self-host job

- **성공 시**: 🌙 **Nightly Verification — PASS**
- **실패 시**: 🌙 **Nightly Verification — FAILED** (긴급)

## 2단계: Artifact 관리

### Artifact 보관 정책

| 타입 | 보관 기간 | 용도 |
|------|---------|------|
| **Nightly results** | 30일 | 장기 히스토리 |
| **PR scan-verify** | 7일 | PR 디버깅 |
| **Jest results** | 7일 | 테스트 재현 |

### Artifact 다운로드 (실패 시)

1. Actions → 해당 failed run
2. **Artifacts** 섹션 → `nightly-results-{id}` 다운로드
3. `stage1.js`, `stage2.js`, `stage3.js` 확인

```bash
# 로컬에서 diff 확인
diff stage1.js stage2.js | head -50
```

## 3단계: 자동 이슈 생성 (선택)

### GitHub Actions에서 실패 시 자동 이슈 생성

`.github/workflows/phase-c-full-slack.yml` 다음에 추가:

```yaml
  auto-issue-on-nightly-fail:
    runs-on: ubuntu-latest
    needs: nightly-self-host
    if: |
      github.event_name == 'schedule' &&
      needs.nightly-self-host.result == 'failure'

    steps:
      - name: Create Failure Issue
        uses: actions/github-script@v7
        with:
          script: |
            const issue = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `🌙 Nightly Failed — ${new Date().toISOString().split('T')[0]}`,
              body: `
            ## Nightly Self-Hosting Verification Failed

            **Date:** ${new Date().toISOString()}
            **Run:** [${{ github.run_id }}](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})

            ### Action Required

            1. Review artifacts: \`nightly-results-${{ github.run_id }}\`
            2. Check stage*.js diff:
               \`\`\bash
               diff stage1.js stage2.js
               \`\`\`
            3. Identify root cause
            4. Create fix PR
            5. Close this issue once fixed

            ### Debugging

            - [View Workflow Run](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
            - [View Artifacts](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}/attempts/1)
              `,
              labels: ['🌙 nightly', '🚨 ci-failure', 'urgent']
            });
            console.log(`Issue created: #${issue.data.number}`);
```

## 4단계: 이상 패턴 감지

### 자동 탐지할 문제들

| 증상 | 원인 | 대응 |
|------|------|------|
| **Fixed-point 불일치** | codegen 비결정성 | 커밋 diff 검토, 롤백 고려 |
| **Jest shard 실패** | 회귀 또는 flaky test | 해당 테스트 수정/격리 |
| **Scan 토큰 발견** | 새 builtin 미매핑 | BUILTIN_MAP 추가 |
| **시간 초과** | 성능 저하 | 병렬화 수준 증가 |

### Flaky Test 추적

```bash
# 같은 test가 반복 실패하는지 추적
# → nightly artifact에서 같은 test 이름 검색
# → 반복 시 제외 또는 수정
```

## 5단계: 대시보드 구성 (선택)

### GitHub Pages에 결과 발행

1. `.github/workflows/phase-c-full-slack.yml` 끝에 추가:

```yaml
  publish-nightly-results:
    runs-on: ubuntu-latest
    needs: nightly-self-host
    if: github.event_name == 'schedule'

    steps:
      - name: Download Artifacts
        uses: actions/download-artifact@v4
        with:
          name: nightly-results-${{ github.run_id }}
          path: nightly

      - name: Generate Report
        run: |
          cat > nightly/README.md << 'EOF'
          # Nightly Results — $(date -u)

          - stage1.js: present
          - stage2.js: present
          - stage3.js: present

          Status: ✅ PASS
          EOF

      - name: Deploy to Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: nightly
```

## 6단계: 롤백 계획

### Nightly 실패 시 롤백 절차

**1. 빠른 진단 (5분)**

```bash
# Artifact 다운로드 후
diff stage1.js stage2.js | head -100
git log -3 --oneline
```

**2. 원인 파악 (10분)**

- Git diff 확인: 최근 커밋이 원인인가?
- 의도적 변경인가? → baseline SHA 업데이트
- 버그인가? → 긴급 수정 필요

**3. 롤백 (15분)**

```bash
# 옵션 A: 간단한 커밋 롤백
git revert HEAD --no-edit
git push origin master

# 옵션 B: 긴급 hotfix 브랜치
git checkout -b hotfix/nightly-fix
# ... 수정 ...
git push origin hotfix/nightly-fix
# → PR 생성 및 병합
```

**4. 재실행 (즉시)**

```bash
# 수동으로 다음 nightly 트리거
# (또는 12시간 대기)
```

## 7단계: 월간 리포트

### 월말 nightly 성공률 정리

```
📊 April 2026 Nightly Summary

Total runs: 30
Success: 28 ✅
Failure: 2 ❌
Success rate: 93.3%

Failed dates:
- 2026-04-15: Fixed-point drift (corrected)
- 2026-04-20: flaky test (now isolated)

Action items:
- [ ] Add more determinism tests
- [ ] Improve shard balance
```

## 참고

- [Schedule workflow syntax](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Creating issues via GitHub API](https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28)
- [Artifact retention](https://docs.github.com/en/actions/managing-workflow-runs/removing-workflow-artifacts)
