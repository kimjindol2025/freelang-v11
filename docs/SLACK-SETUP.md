# Slack 통합 설정 가이드

## 개요

GitHub Actions에서 Phase C CI 파이프라인 결과를 Slack에 자동으로 알립니다.

## 1단계: Slack Webhook URL 생성

### Slack 앱 생성 (처음 한 번만)

1. [Slack API 대시보드](https://api.slack.com/apps) 방문
2. **Create New App** → **From scratch**
3. **App Name**: `FreeLang CI`
4. **Workspace**: 귀 워크스페이스 선택
5. **Create App** 클릭

### Incoming Webhook 활성화

1. 좌측 메뉴 → **Incoming Webhooks**
2. **Activate Incoming Webhooks** 켜기
3. **Add New Webhook to Workspace**
4. **Select Channel**: `#freelang-ci` (또는 원하는 채널)
5. **Allow** 클릭
6. **Webhook URL** 복사 (예: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`)

## 2단계: GitHub Secrets 설정

### Repository Settings에서 Secret 추가

1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. **Name**: `SLACK_WEBHOOK_URL`
4. **Value**: 위에서 복사한 Webhook URL
5. **Add secret**

## 3단계: Workflow 선택

### 옵션 A: Slack 통합 버전 사용 (권장)

현재 파일: `.github/workflows/phase-c-full-slack.yml`

```bash
# feature 브랜치에서 테스트
git push origin feature/phase-c-fuzz

# PR 생성 → CI 자동 트리거 → Slack 알림 수신
```

### 옵션 B: 기본 버전 유지

현재 파일: `.github/workflows/phase-c-full.yml` (Slack 없음)

## Slack 메시지 형식

### 1️⃣ Scan 실패 (Early-fail)

```
❌ Phase C — Scan Failed
Branch: feature/phase-c-fuzz
Run: View Logs [링크]

Action Required:
1. Check artifact: scan-verify-artifacts
2. Fix mapping in src/codegen-js.ts
3. Re-submit PR
```

### 2️⃣ Scan 성공

```
✅ Phase C — Scan Passed
Branch: feature/phase-c-fuzz
Stage1 SHA: 23cafedb614a48a3...

Results:
• Scan: ✅ PASS
• Verify: ✅ PASS
• Regression: ✅ PASS

Next: Regression tests + Full Jest...
```

### 3️⃣ 모두 성공 (머지 가능)

```
✨ Phase C — All Green (Ready to Merge)
Branch: feature/phase-c-fuzz
Commit: abc123def456...

Phase Results:
• ✅ Scan & Verify: PASS
• ✅ Regression: PASS
• ✅ Jest (3 shards): PASS

Status: 🟢 Ready for merge

[View PR] • [View Run]
```

### 4️⃣ 일부 실패

```
⚠️ Phase C — Check Failed
Branch: feature/phase-c-fuzz

Failed Phase(s):
• Scan & Verify: success
• Regression: success
• Jest: failure

Review logs and artifacts.

[📋 View Detailed Logs]
```

### 5️⃣ Nightly 성공

```
🌙 Nightly Self-Hosting Verification — PASS
Time: 2026-04-23 02:00 UTC
Branch: master

Results:
• Build: ✅
• Fixed-Point: ✅
• Jest (643 tests): ✅
```

### 6️⃣ Nightly 실패

```
🌙 Nightly Self-Hosting Verification — FAILED
Time: 2026-04-23 02:00 UTC
Action Required: Review logs immediately

[View Nightly Run]
```

## 커스터마이징

### 채널 변경

`.github/workflows/phase-c-full-slack.yml`에서:

```yaml
env:
  SLACK_CHANNEL: '#freelang-ci'  # ← 변경
```

### 알림 수신자 지정

`@channel` 또는 `@here` 멘션 추가:

```yaml
"text": "⚠️ Phase C — Scan Failed\n<!channel>"
```

### 추가 알림 조건

```yaml
- name: "🔔 Slack Notify — Custom Event"
  if: failure() && contains(github.ref, 'master')  # master 브랜치 실패만
  uses: slackapi/slack-github-action@v1.24.0
  with:
    webhook-url: ${{ env.SLACK_WEBHOOK }}
    payload: |
      { ... }
```

## 문제 해결

### 메시지가 오지 않음

1. Webhook URL 확인 (Settings → Secrets)
2. 채널 접근권한 확인
3. CI 로그 확인 (Actions → 해당 run → Slack 단계)

### 메시지 형식 오류

```
SyntaxError: JSON.parse error in payload
```

→ JSON 형식 확인 (따옴표, 콤마, 괄호)

## 참고

- [Slack API Docs](https://api.slack.com/messaging)
- [GitHub Slack Action](https://github.com/slackapi/slack-github-action)
- [Incoming Webhooks Guide](https://api.slack.com/messaging/webhooks)
