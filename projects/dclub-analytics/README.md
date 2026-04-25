# dclub-analytics — 자주권 웹 분석 (Phase Y1)

Google Analytics 의존 없이 자기 인프라에서 페이지뷰·이벤트·세션을 수집·시각화하는 SaaS.
정통망법 마케팅 (개인정보 회피) 기본값.

## 특징

- **외부 npm 0** — 100% FreeLang v11
- **쿠키 없음** — IP/UA 는 salted SHA256 해시만 저장
- **CORS 전체 허용** — 외부 도메인에서 자유롭게 호출
- **SVG sparkline** — 차트 라이브러리 0
- **`<noscript>` 픽셀** fallback (`/pixel.gif`)
- **JS SDK** — `sendBeacon` + `localStorage` 큐 (오프라인 대응)

## 라우트

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 상태 |
| POST | `/track` | 이벤트 수집 (CORS) |
| GET | `/pixel.gif?site=...` | no-JS fallback |
| GET | `/sdk.js` | 트래커 JS |
| GET | `/dashboard?site=...` | SSR 대시보드 |
| POST | `/sites` | 사이트 등록 (Bearer 필요) |
| GET | `/sites` | 본인 사이트 목록 (Bearer 필요) |

## 설치

```bash
DCLUB_ANALYTICS_DB=/var/dclub/analytics.db \
DCLUB_ANALYTICS_PORT=30160 \
DCLUB_ANALYTICS_IP_SALT="$(openssl rand -hex 16)" \
node bootstrap.js run projects/dclub-analytics/app/server.fl
```

## 사용 예 (사이트 측)

```html
<script src="https://analytics.dclub.kr/sdk.js"></script>
<script>
  var t = DclubAnalytics.createTracker("s_yoursite", "https://analytics.dclub.kr");
  // pageview 자동 발사 — DOMContentLoaded
  t.event("signup_click", { plan: "pro" });
</script>
```

## E2E 검증

```bash
bash projects/dclub-analytics/tests/smoke-analytics.sh
```

10개 케이스 — health, 알 수 없는 site 404, pageview, event, 30 burst, pixel.gif,
dashboard SSR, sparkline SVG, /sdk.js, 무인증 401.

## 보안 모델

- 트래킹 자체는 site_id 만 알면 가능 (의도된 design — GA 와 동일)
- 사이트 등록·관리만 Bearer JWT 필요 (sub claim → owner)
- 서명 검증은 dclub-iap 가 담당 (또는 추후 dclub-auth JWKS 직결)
- 운영: dclub-iap 뒤에 두면 자동 인증
