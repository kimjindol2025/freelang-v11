# FreeLang v11 — Cron 자동화 가이드

매일 새벽 자동 회귀 검출 + 결과 알림 워크플로우.

## 빠른 시작

### 1. 등록

```bash
crontab -e
# 매일 새벽 3시 실행
0 3 * * * /bin/bash /root/kim/freelang-v11/scripts/cron-daily-verify.sh
```

### 2. 수동 테스트 (먼저 한 번)

```bash
bash /root/kim/freelang-v11/scripts/cron-daily-verify.sh
# → logs/cron-verify-{날짜}.log 확인
```

### 3. 회귀 알림 (선택)

블로그 자동 포스팅으로 회귀 검출 시 알림:

```bash
# crontab -e
BLOG_API_KEY=flblog-...
0 3 * * * /bin/bash /root/kim/freelang-v11/scripts/cron-daily-verify.sh
```

## 동작

매 실행마다:
1. **git pull** (master 최신화 — 환경변수 `SKIP_GIT_PULL=1`로 비활성)
2. **npm run build** (TS → bootstrap.js)
3. **make verify-all** (Build determinism + Deep fixed-point + Tier2 + FL-Bench)
4. **회귀 검출**: `logs/last-verify.json`과 비교
5. **알림**: 회귀 시 블로그 포스팅 (옵션)

## 결과물

```
logs/
├── cron-verify-2026-04-25.log    # 일별 로그
├── cron-verify-2026-04-26.log
├── last-verify.json              # 마지막 결과 (회귀 검출용)
└── ...
```

## 환경변수

| 변수 | 효과 |
|------|------|
| `SKIP_GIT_PULL=1` | git pull 건너뜀 (offline) |
| `BLOG_API_KEY=...` | 회귀 시 블로그 자동 알림 |

## 모니터링

```bash
# 최근 7일 결과
ls -lt logs/cron-verify-*.log | head -7

# 회귀 발생 여부
grep "회귀 발견" logs/cron-verify-*.log

# 평균 소요 시간
grep "ELAPSED" logs/cron-verify-*.log
```

## 권장 cron 일정

```cron
# 매일 새벽 3시 (메인)
0 3 * * * /bin/bash /root/kim/freelang-v11/scripts/cron-daily-verify.sh

# 매주 일요일 새벽 4시 (full ai-eval, 비용 발생)
0 4 * * 0 /bin/bash /root/kim/freelang-v11/scripts/cron-weekly-ai-eval.sh

# 매월 1일 새벽 5시 (전체 모델 비교)
0 5 1 * * /bin/bash /root/kim/freelang-v11/scripts/cron-monthly-models.sh
```

(weekly/monthly 스크립트는 추후 확장)

## 문제 해결

### git pull 실패
- 인증: `git config --global credential.helper store`
- offline: `SKIP_GIT_PULL=1` 설정

### build 실패
- node_modules 재설치: `rm -rf node_modules && npm install`

### verify-all 일부 fail
- mongodb-* / binary는 advisory (`KNOWN_STAGE1_CODEGEN_GAP`)
- 새 fail이면 commit log 확인 + 별도 조사
