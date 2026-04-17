# v11 Blog Demo

FreeLang v11으로 만든 정적 블로그. Node.js v25 하나만 필요.

## 구조

```
blog-demo/
├── bootstrap.js          # v11 런타임 (1.1MB)
├── app/
│   ├── page.fl           # /
│   ├── about/page.fl     # /about
│   └── blog/
│       ├── page.fl       # /blog (목록)
│       ├── hello-v11/page.fl
│       ├── build-static/page.fl
│       └── auto-bind/page.fl       ← 인라인 JS로 실제 인터랙션 포함
└── dist/                 # 빌드 결과물 (gitignore 권장)
```

## 빌드

```bash
node bootstrap.js build --static --app app --out dist --port 43088
```

출력 예:
```
[Static Build]  app/ → dist/
✓ /              → dist/index.html  (3182 bytes)
✓ /about         → dist/about/index.html  (2268 bytes)
✓ /blog          → dist/blog/index.html  (2056 bytes)
✓ /blog/hello-v11   → dist/blog/hello-v11/index.html  (2825 bytes)
✓ /blog/build-static → dist/blog/build-static/index.html  (2658 bytes)
✓ /blog/auto-bind   → dist/blog/auto-bind/index.html  (4762 bytes)

[완료]  6 pages built, 0 failed → dist/
```

## 배포

`dist/` 폴더를 그대로 CDN에 업로드:

- **Netlify**: `netlify deploy --dir=dist --prod`
- **Vercel**: `vercel --prod dist`
- **Cloudflare Pages**: `wrangler pages deploy dist`
- **GitHub Pages**: `gh-pages -d dist`
- **S3**: `aws s3 sync dist/ s3://bucket/ --delete`

## 개발 (Hot Reload)

```bash
# 개별 페이지 빠른 확인
node bootstrap.js run app/page.fl | less

# 동적 서빙 + 브라우저 자동 새로고침
node bootstrap.js serve --app app/ --port 43000
# (serve는 app-router 렌더링 정책에 의존 — 현재 단순 println 페이지는 run으로 만드는 방식이 안정)
```

## 포함된 기능 데모

| 포스트 | 시연하는 v11 기능 |
|-------|------------------|
| `/blog/hello-v11` | 문서 스타일, OG 메타데이터 |
| `/blog/build-static` | 정적 export 내부 동작 설명 |
| `/blog/auto-bind` | `data-fl-bind`, `data-fl-model`, `data-fl-click` — **실제 동작 카운터** |

`auto-bind` 포스트를 브라우저에서 열면 카운터와 이름 입력 (localStorage 저장) 인터랙션이 실제로 동작합니다.

## 제약 사항 (현실)

- **v11의 app-router + serve가 현재 IMPORT/컴포넌트 블록 해석에 버그가 있음**. 이 데모는 이를 우회하여 각 `page.fl`이 `(println full-html)` 방식으로 self-contained.
- `stdlib/web/metadata.fl` 등의 헬퍼는 `serve` 모드 경로 해석이 고쳐지면 바로 사용 가능.
- 빌드는 `run` fallback으로 안정 작동 중 (`build --static`의 Strategy 2).

## 다음 단계

- [ ] v11 serve의 import resolve 버그 수정
- [ ] 동적 라우트 `[slug]` — `generateStaticParams` 유사 API
- [ ] 마크다운 → HTML 변환 stdlib 추가
- [ ] RSS feed 자동 생성
