# FreeLang v11 — UI 패턴 가이드

> **선택 기준**  
> 단일 페이지 / CRUD / 대시보드 → **FreeLang + HTML/JS** (이 문서)  
> 3패널 / 트리 / 복잡한 상태관리 → **Next.js 유지**

---

## 📁 폴더 구조 (표준)

```
my-app/
├── src/
│   └── server.fl          ← FreeLang 서버 (API + HTML 서빙)
├── public/
│   ├── index.html         ← 단일 HTML 진입점
│   ├── app.js             ← 브라우저 JS (fetch API 호출)
│   └── style.css          ← 스타일
├── run.sh                 ← 실행 스크립트
└── .env                   ← 환경변수
```

---

## 🖥️ server.fl 패턴

```lisp
;; src/server.fl
(load ".env")

(define PORT (or (str-to-num (shell_env "PORT")) 40200))
(define API-KEY (or (shell_env "API_KEY") ""))

;; ── HTML 서빙 ─────────────────────────────────────────────────────

(defn handle-index [$req]
  (server_html (file_read "public/index.html")))

(defn handle-static [$req]
  (server_static (str "public/" (server_req_param $req "file"))))

;; ── API ──────────────────────────────────────────────────────────

(defn handle-get-items [$req]
  (server_json {:success true :data (get-all-items)}))

(defn handle-post-item [$req]
  (let [[$body (json_parse (server_req_body $req))]
        [$name (get $body "name")]]
    (if $name
      (do (save-item $name)
          (server_json {:success true}))
      (server_status 400 {:error "name required"}))))

;; ── 라우트 등록 ──────────────────────────────────────────────────

(server_get  "/"               "handle-index")
(server_get  "/static/:file"   "handle-static")   ;; CSS/JS 서빙
(server_get  "/api/items"      "handle-get-items")
(server_post "/api/items"      "handle-post-item")
(println (str "[START] port " PORT))
(server_start PORT)
```

---

## 🌐 public/index.html 패턴

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>앱 이름</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="app">
    <h1>앱 이름</h1>
    <div id="list"></div>
    <form id="form">
      <input id="name" type="text" placeholder="이름">
      <button type="submit">추가</button>
    </form>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>
```

---

## ⚙️ public/app.js 패턴

```javascript
// public/app.js — 순수 JS (프레임워크 없음)
const API = '';  // 같은 origin이면 빈 문자열

// ── 공통 fetch 래퍼 ───────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',   // 쿠키 자동 포함
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

const get  = (path)        => api('GET',  path);
const post = (path, body)  => api('POST', path, body);
const del  = (path)        => api('DELETE', path);
const put  = (path, body)  => api('PUT',  path, body);

// ── 상태 ──────────────────────────────────────────────────────────

let items = [];

// ── 렌더링 ────────────────────────────────────────────────────────

function render() {
  document.getElementById('list').innerHTML = items.map(item => `
    <div class="item">
      <span>${item.name}</span>
      <button onclick="deleteItem('${item.id}')">삭제</button>
    </div>
  `).join('');
}

// ── API 호출 ──────────────────────────────────────────────────────

async function loadItems() {
  const data = await get('/api/items');
  items = data.data ?? [];
  render();
}

async function deleteItem(id) {
  await del(`/api/items/${id}`);
  await loadItems();
}

// ── 폼 제출 ───────────────────────────────────────────────────────

document.getElementById('form').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  if (!name) return;
  await post('/api/items', { name });
  document.getElementById('name').value = '';
  await loadItems();
});

// ── 초기화 ────────────────────────────────────────────────────────

loadItems();
```

---

## 🔐 인증 패턴 (SSO 쿠키 → API Key)

```lisp
;; server.fl — 쿠키에서 세션 검증
(defn auth-check [$req]
  (let [[$token (server_req_cookie $req "session_token")]]
    (if $token
      (auth_jwt_verify $token SESSION-SECRET)
      nil)))

(defn handle-protected [$req]
  (let [[$user (auth-check $req)]]
    (if $user
      (server_json {:data (get-user-data (get $user "user_id"))})
      (server_status 401 {:error "Unauthorized"}))))
```

```javascript
// app.js — 401 시 로그인 페이지로
async function api(method, path, body) {
  const res = await fetch(path, { method, credentials: 'include', ... });
  if (res.status === 401) {
    window.location.href = '/login';
    return;
  }
  return res.json();
}
```

---

## 📊 언제 무엇을 쓸지

| 케이스 | FreeLang + HTML/JS | Next.js |
|--------|-------------------|---------|
| CRUD 목록 + 폼 | ✅ | 과함 |
| 단순 대시보드 | ✅ | 과함 |
| 설정 페이지 | ✅ | 과함 |
| 3패널 레이아웃 | △ 직접 구현 | ✅ |
| 트리 구조 렌더링 | △ 재귀 HTML | ✅ |
| 복잡한 상태 (useState급) | ❌ | ✅ |
| SSR / SEO 필요 | ❌ | ✅ |

---

## ✅ 체크리스트 (FreeLang UI 작업 시)

```
[ ] server.fl — server_get "/" "handle-index" 선언
[ ] public/index.html — <script src="/static/app.js"> 포함
[ ] server.fl — GET /static/:file → server_static 등록
[ ] app.js — fetch에 credentials: 'include' 포함
[ ] 401 → 로그인 리다이렉트 처리
[ ] .env — PORT, API_KEY 설정
[ ] run.sh — node bootstrap.js run src/server.fl
```

---

## 🚀 run.sh

```bash
#!/bin/bash
export $(cat .env | xargs)
node /home/kimjin/freelang-v11/bootstrap.js run src/server.fl
```
