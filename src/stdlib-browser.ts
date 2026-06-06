// FreeLang v11 — Browser stdlib
// DOM, Event, Fetch, Storage, WebCrypto 함수 모음
// Node.js 의존성 0개 — 브라우저 전용

export function createBrowserModule(callFn?: (name: string, args: any[]) => any) {

  // 이벤트 핸들러 보관 (GC 방지)
  const eventHandlers = new Map<string, EventListener>();

  return {
    // ── DOM 선택 ───────────────────────────────────────────────────
    // dom_select selector -> Element | null
    "dom_select": (selector: string) => {
      return document.querySelector(selector);
    },
    // dom_select_all selector -> [Element]
    "dom_select_all": (selector: string) => {
      return Array.from(document.querySelectorAll(selector));
    },
    // dom_by_id id -> Element | null
    "dom_by_id": (id: string) => {
      return document.getElementById(id);
    },

    // ── DOM 읽기 ───────────────────────────────────────────────────
    // dom_text el -> string
    "dom_text": (el: Element) => el?.textContent ?? "",
    // dom_html el -> string
    "dom_html": (el: Element) => el?.innerHTML ?? "",
    // dom_attr el attr -> string
    "dom_attr": (el: Element, attr: string) => el?.getAttribute(attr) ?? "",
    // dom_val el -> string  (input value)
    "dom_val": (el: HTMLInputElement) => el?.value ?? "",

    // ── DOM 쓰기 ───────────────────────────────────────────────────
    // dom_set_text el text -> null
    "dom_set_text": (el: Element, text: string) => {
      if (el) el.textContent = String(text);
      return null;
    },
    // dom_set_html el html -> null
    "dom_set_html": (el: Element, html: string) => {
      if (el) el.innerHTML = String(html);
      return null;
    },
    // dom_set_attr el attr value -> null
    "dom_set_attr": (el: Element, attr: string, value: string) => {
      if (el) el.setAttribute(attr, String(value));
      return null;
    },
    // dom_set_val el value -> null  (input)
    "dom_set_val": (el: HTMLInputElement, value: string) => {
      if (el) el.value = String(value);
      return null;
    },
    // dom_set_style el prop value -> null
    "dom_set_style": (el: HTMLElement, prop: string, value: string) => {
      if (el) (el.style as any)[prop] = value;
      return null;
    },

    // ── DOM 클래스 ─────────────────────────────────────────────────
    // dom_add_class el cls -> null
    "dom_add_class": (el: Element, cls: string) => {
      el?.classList.add(cls); return null;
    },
    // dom_remove_class el cls -> null
    "dom_remove_class": (el: Element, cls: string) => {
      el?.classList.remove(cls); return null;
    },
    // dom_toggle_class el cls -> boolean
    "dom_toggle_class": (el: Element, cls: string) => {
      return el?.classList.toggle(cls) ?? false;
    },
    // dom_has_class el cls -> boolean
    "dom_has_class": (el: Element, cls: string) => {
      return el?.classList.contains(cls) ?? false;
    },

    // ── DOM 생성/삽입/제거 ─────────────────────────────────────────
    // dom_create tag -> Element
    "dom_create": (tag: string) => document.createElement(tag),
    // dom_append parent child -> null
    "dom_append": (parent: Element, child: Element) => {
      parent?.appendChild(child); return null;
    },
    // dom_prepend parent child -> null
    "dom_prepend": (parent: Element, child: Element) => {
      parent?.prepend(child); return null;
    },
    // dom_remove el -> null
    "dom_remove": (el: Element) => {
      el?.remove(); return null;
    },
    // dom_show el -> null
    "dom_show": (el: HTMLElement) => {
      if (el) el.style.display = ""; return null;
    },
    // dom_hide el -> null
    "dom_hide": (el: HTMLElement) => {
      if (el) el.style.display = "none"; return null;
    },
    // dom_toggle el -> null
    "dom_toggle": (el: HTMLElement) => {
      if (el) el.style.display = el.style.display === "none" ? "" : "none";
      return null;
    },

    // ── 이벤트 ────────────────────────────────────────────────────
    // event_on el event handlerName -> null  (FL 함수명으로 등록)
    "event_on": (el: Element, event: string, handlerName: string) => {
      const handler: EventListener = (e) => {
        if (callFn) callFn(handlerName, [e]);
      };
      const key = `${event}:${handlerName}`;
      eventHandlers.set(key, handler);
      el?.addEventListener(event, handler);
      return null;
    },
    // event_off el event handlerName -> null
    "event_off": (el: Element, event: string, handlerName: string) => {
      const key = `${event}:${handlerName}`;
      const handler = eventHandlers.get(key);
      if (handler) { el?.removeEventListener(event, handler); eventHandlers.delete(key); }
      return null;
    },
    // event_target e -> Element
    "event_target": (e: Event) => e?.target,
    // event_val e -> string  (input 이벤트에서 값 추출)
    "event_val": (e: Event) => (e?.target as HTMLInputElement)?.value ?? "",
    // event_prevent e -> null
    "event_prevent": (e: Event) => { e?.preventDefault(); return null; },
    // event_stop e -> null
    "event_stop": (e: Event) => { e?.stopPropagation(); return null; },

    // ── HTTP Fetch ─────────────────────────────────────────────────
    // fetch_get url -> {ok, status, data}  (동기 불가 → Promise 반환)
    "fetch_get": async (url: string) => {
      const r = await fetch(url, { credentials: "include" });
      const data = r.headers.get("content-type")?.includes("json")
        ? await r.json() : await r.text();
      return { ok: r.ok, status: r.status, data };
    },
    // fetch_post url body -> {ok, status, data}
    "fetch_post": async (url: string, body: any) => {
      const r = await fetch(url, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = r.headers.get("content-type")?.includes("json")
        ? await r.json() : await r.text();
      return { ok: r.ok, status: r.status, data };
    },
    // fetch_put url body -> {ok, status, data}
    "fetch_put": async (url: string, body: any) => {
      const r = await fetch(url, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = r.headers.get("content-type")?.includes("json")
        ? await r.json() : await r.text();
      return { ok: r.ok, status: r.status, data };
    },
    // fetch_delete url -> {ok, status, data}
    "fetch_delete": async (url: string) => {
      const r = await fetch(url, { method: "DELETE", credentials: "include" });
      const data = r.headers.get("content-type")?.includes("json")
        ? await r.json() : await r.text();
      return { ok: r.ok, status: r.status, data };
    },

    // ── localStorage ──────────────────────────────────────────────
    // storage_set key value -> null
    "storage_set": (key: string, value: any) => {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
      return null;
    },
    // storage_get key -> string | null
    "storage_get": (key: string) => {
      const v = localStorage.getItem(key);
      if (v === null) return null;
      try { return JSON.parse(v); } catch { return v; }
    },
    // storage_remove key -> null
    "storage_remove": (key: string) => {
      localStorage.removeItem(key); return null;
    },
    // storage_clear -> null
    "storage_clear": () => { localStorage.clear(); return null; },

    // ── 브라우저 유틸 ─────────────────────────────────────────────
    // browser_url -> string
    "browser_url": () => location.href,
    // browser_path -> string
    "browser_path": () => location.pathname,
    // browser_go url -> null
    "browser_go": (url: string) => { location.href = url; return null; },
    // browser_push url -> null  (history API)
    "browser_push": (url: string) => { history.pushState({}, "", url); return null; },
    // browser_reload -> null
    "browser_reload": () => { location.reload(); return null; },
    // browser_alert msg -> null
    "browser_alert": (msg: string) => { alert(msg); return null; },
    // browser_confirm msg -> boolean
    "browser_confirm": (msg: string) => confirm(msg),
    // browser_title -> string
    "browser_title": () => document.title,
    // browser_set_title title -> null
    "browser_set_title": (title: string) => { document.title = title; return null; },

    // ── WebCrypto (비밀번호 해싱 등) ──────────────────────────────
    // wcrypto_random_hex n -> string  (n 바이트 hex)
    "wcrypto_random_hex": (n: number) => {
      const buf = new Uint8Array(n);
      crypto.getRandomValues(buf);
      return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    // wcrypto_sha256 str -> Promise<string>
    "wcrypto_sha256": async (str: string) => {
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest("SHA-256", buf);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    },

    // ── 타이머 ────────────────────────────────────────────────────
    // browser_timeout ms handlerName -> id
    "browser_timeout": (ms: number, handlerName: string) => {
      return setTimeout(() => { if (callFn) callFn(handlerName, []); }, ms);
    },
    // browser_interval ms handlerName -> id
    "browser_interval": (ms: number, handlerName: string) => {
      return setInterval(() => { if (callFn) callFn(handlerName, []); }, ms);
    },
    // browser_clear_timer id -> null
    "browser_clear_timer": (id: number) => { clearTimeout(id); clearInterval(id); return null; },
  };
}
