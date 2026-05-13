# FreeLang v11 — UI 패턴 가이드

> **핵심 원칙**: JavaScript는 선택사항이다. FreeLang SSR만으로 완전한 앱이 된다.

---

## 🏗️ 아키텍처 선택지

FreeLang은 세 가지 UI 전략을 지원한다.

```
[전략 A] 순수 SSR — JS 0줄
  브라우저 → form POST → FreeLang → HTML 응답 → 브라우저 렌더링

[전략 B] SSR + 최소 JS — JS 필요한 부분만
  FreeLang이 HTML 생성 → 브라우저가 필요한 부분만 JS로 처리

[전략 C] API 서버 + 클라이언트 JS — 실시간 앱
  FreeLang은 JSON API만 제공 → 브라우저 JS가 렌더링 담당
```

**기본값은 전략 A** — 실시간 기능이 필요할 때만 B/C로 올린다.

---

## 전략 A — 순수 SSR (JS 0줄)

FreeLang이 HTML을 완전히 렌더링한다. 브라우저는 받은 HTML을 그대로 표시한다.

```lisp
;; server.fl
(defn handle-index [req]
  (let [items (db-query DB "SELECT * FROM items" [])]
    (server-html
      (str """
        <!DOCTYPE html>
        <html>
        <body>
          <ul>
            ${(str-join "" (map (fn [item]
              (str "<li>" (html-escape (get item "name")) "</li>"))
              items))}
          </ul>
          <form method="POST" action="/items">
            <input name="name" placeholder="이름">
            <button type="submit">추가</button>
          </form>
        </body>
        </html>
      """))))

(defn handle-post-item [req]
  (let [body (get req "body")
        name (get body "name")]
    (if name
      (do
        (db-exec DB "INSERT INTO items (name) VALUES (?)" [name])
        (server-redirect "/"))
      (server-status 400 "name required"))))

(server-get  "/"       handle-index)
(server-post "/items"  handle-post-item)
(server-start 40100)
```

**언제 쓰나**: CRUD, 관리자 페이지, 설정 화면, 대시보드 — 대부분의 앱.

---

## 전략 B — SSR + 최소 JS

FreeLang이 HTML을 생성하고, 꼭 필요한 부분(탭 전환, 미리보기 등)만 인라인 JS로 처리한다.

```lisp
(defn handle-index [req]
  (server-html """
    <!DOCTYPE html>
    <html>
    <body>
      <button onclick="document.getElementById('panel').style.display='block'">
        열기
      </button>
      <div id="panel" style="display:none">내용</div>

      <form method="POST" action="/items">
        <input name="name">
        <button>추가</button>
      </form>
    </body>
    </html>
  """))
```

**언제 쓰나**: 탭/패널 전환, 폼 유효성 검사, 파일 미리보기처럼 순수 UI 상태만 필요할 때.

---

## 전략 C — API + 클라이언트 JS

FreeLang은 JSON API만 제공하고, 브라우저 JS가 렌더링을 담당한다.

```lisp
;; server.fl — JSON API만
(defn handle-get-items [req]
  (server-json {:ok true :data (db-query DB "SELECT * FROM items" [])}))

(server-get "/api/items" handle-get-items)
(server-start 40100)
```

```javascript
// app.js — 브라우저에서 렌더링
fetch('/api/items')
  .then(r => r.json())
  .then(data => {
    document.getElementById('list').innerHTML =
      data.data.map(item => `<li>${item.name}</li>`).join('');
  });
```

**언제 쓰나**: 실시간 업데이트, WebSocket, 카운트다운 타이머처럼 서버 왕복 없이 화면이 바뀌어야 할 때.

---

## 📊 전략 선택 기준

| 기능 | 전략 A (SSR) | 전략 B (SSR+JS) | 전략 C (API+JS) |
|------|-------------|----------------|----------------|
| CRUD 목록/폼 | ✅ 최적 | 가능 | 과함 |
| 관리자 대시보드 | ✅ 최적 | 가능 | 과함 |
| 탭/패널 전환 | 페이지 새로고침 | ✅ 최적 | 가능 |
| 폼 실시간 유효성 | 서버에서 처리 | ✅ 최적 | 가능 |
| 실시간 데이터 갱신 | ❌ | ❌ | ✅ 필요 |
| WebSocket 채팅 | ❌ | ❌ | ✅ 필요 |
| 카운트다운 타이머 | ❌ | ✅ 인라인 JS | 가능 |

---

## 📁 폴더 구조

### 전략 A/B (SSR)

```
my-app/
├── app/
│   ├── server.fl       ← 라우팅 + HTML 렌더링
│   └── handlers.fl     ← 비즈니스 로직
├── start.sh
└── .env
```

### 전략 C (API + JS)

```
my-app/
├── app/
│   └── server.fl       ← JSON API
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── start.sh
└── .env
```

---

## 역할 분담

어떤 전략을 선택하든, **비즈니스 로직은 항상 FreeLang**이다.

| 작업 | FreeLang | 브라우저 JS |
|------|----------|-------------|
| 인증·세션 | ✅ 항상 | ❌ 금지 |
| DB 읽기/쓰기 | ✅ 항상 | ❌ 금지 |
| 비즈니스 로직 | ✅ 항상 | ❌ 금지 |
| HTML 생성 | ✅ SSR | 전략 C에서만 |
| 순수 UI 상태 (탭, 토글) | 페이지 새로고침 | ✅ 선택사항 |
| 실시간 화면 갱신 | WebSocket으로 push | ✅ 필요 |

---

## ✅ 체크리스트

```
[ ] 실시간 기능 필요 여부 확인 → 없으면 전략 A
[ ] 순수 UI 상태만 필요 → 전략 B (인라인 JS 최소화)
[ ] WebSocket/실시간 갱신 필요 → 전략 C
[ ] 비즈니스 로직은 항상 FreeLang 서버에서 처리
[ ] html-escape — 사용자 입력은 반드시 이스케이프
[ ] CSRF 토큰 — form POST에 반드시 포함
```

---

## 🚀 start.sh

```bash
#!/bin/bash
export $(cat .env | xargs)
node /root/kim/freelang-v11/bootstrap.js run app/server.fl
```
