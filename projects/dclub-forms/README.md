# dclub-forms — 한국형 설문 SaaS (Phase Y3)

Google Forms / SurveyMonkey 의존 없이 폼 생성 → 공유 → 응답 수집 → 통계·CSV.
모든 응답 자체 인프라 보관, 외부 npm 0.

## 데이터 모델

3 테이블:

- `forms(id, slug, owner, title, description, is_open, anonymous, created_at)`
- `questions(id, form_id, position, type, label, required, options)`
- `responses(id, form_id, respondent, answers JSON, submitted_at)`

질문 타입: `text` / `long` / `choice` (단일) / `multichoice` (복수) / `rating`

## 라우트

| Method | Path | 설명 |
|---|---|---|
| POST | `/forms` | 폼 + 질문 일괄 생성 (Bearer) |
| GET | `/forms` | 본인 폼 목록 |
| GET | `/forms/:slug/results` | JSON 통계 + 응답 (소유자만) |
| GET | `/forms/:slug/csv` | CSV export (소유자만) |
| GET | `/f/:slug` | 다크 SSR 응답 페이지 (무인증) |
| POST | `/f/:slug/submit` | 응답 제출 (form-urlencoded) |

## 통계 (stats.fl)

- choice/rating: 옵션별 카운트
- multichoice: 옵션별 카운트 (배열)
- text/long: 응답 수만

## E2E 검증

```bash
bash projects/dclub-forms/tests/smoke-forms.sh
```

13 케이스 — 무인증 401 · SSR · 정상 제출 · required 누락 400 · 6 응답 · 타인 403 ·
JSON 통계 · CSV 헤더 + 6행 · 폼 목록 · 미존재 404.

## 익명 vs 인증

`anonymous: true` 폼은 IP hash 만, `false` 면 Bearer 필수. MVP 는 둘 다 지원하지만
폼별 토글은 향후 — 현재는 폼 만들기는 인증 필수, 응답은 anonymous 기본.
