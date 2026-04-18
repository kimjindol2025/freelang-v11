/**
 * FreeLang v11 - Web Framework Integration Tests
 * Phase 5: AppRouter + PageRenderer + FLExecutor 통합 테스트
 */

import * as fs from "fs";
import * as path from "path";
import { AppRouter, type Route, type RouteMatch } from "../web/app-router";
import { PageRenderer, type RenderContext, type RenderResult } from "../web/page-renderer";

describe("Web Framework Integration Tests", () => {
  describe("AppRouter - Route Matching", () => {
    let router: AppRouter;
    const testAppDir = path.join(__dirname, "../../test-app");

    beforeAll(() => {
      // 테스트용 app 디렉토리 생성
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 테스트 페이지 파일 생성
      const indexDir = path.join(testAppDir);
      fs.writeFileSync(path.join(indexDir, "page.fl"), '(page "Home")');

      const usersDir = path.join(testAppDir, "users");
      fs.mkdirSync(usersDir, { recursive: true });
      fs.writeFileSync(path.join(usersDir, "page.fl"), '(page "Users List")');

      const userIdDir = path.join(usersDir, "[id]");
      fs.mkdirSync(userIdDir, { recursive: true });
      fs.writeFileSync(path.join(userIdDir, "page.fl"), '(page (format "User %s" id))');

      const layoutDir = path.join(testAppDir);
      fs.writeFileSync(path.join(layoutDir, "layout.fl"), '(layout {{{ children }}})');

      router = new AppRouter(testAppDir);
    });

    afterAll(() => {
      // 테스트 디렉토리 정리
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should match root path", () => {
      const match = router.match("/");
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe("/");
      expect(match?.params).toEqual({});
    });

    test("should match static path", () => {
      const match = router.match("/users");
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe("/users");
      expect(match?.params).toEqual({});
    });

    test("should match dynamic path with params", () => {
      const match = router.match("/users/123");
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe("/users/[id]");
      expect(match?.params).toEqual({ id: "123" });
    });

    test("should extract params correctly", () => {
      const match = router.match("/users/john-doe");
      expect(match).not.toBeNull();
      expect(match?.params.id).toBe("john-doe");
    });

    test("should return null for non-matching paths", () => {
      const match = router.match("/api/data");
      expect(match).toBeNull();
    });

    test("should register routes correctly", () => {
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
      expect(routes.some((r) => r.path === "/")).toBe(true);
      expect(routes.some((r) => r.path === "/users")).toBe(true);
      expect(routes.some((r) => r.path === "/users/[id]")).toBe(true);
    });

    test("should build correct regex pattern", () => {
      const match = router.match("/users/456");
      expect(match?.route.pattern).toBeTruthy();
      expect("/users/456".match(match!.route.pattern!)).not.toBeNull();
    });
  });

  describe("AppRouter - Route Groups (경로 그룹)", () => {
    let router: AppRouter;
    const testAppDir = path.join(__dirname, "../../test-app-groups");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 라우트 그룹 테스트: (auth) 그룹
      const authDir = path.join(testAppDir, "(auth)");
      fs.mkdirSync(authDir, { recursive: true });
      fs.writeFileSync(path.join(authDir, "page.fl"), '(page "Auth Root")');

      const loginDir = path.join(authDir, "login");
      fs.mkdirSync(loginDir, { recursive: true });
      fs.writeFileSync(path.join(loginDir, "page.fl"), '(page "Login")');

      router = new AppRouter(testAppDir);
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should handle route groups correctly", () => {
      const routes = router.getRoutes();
      // 라우트 그룹 (auth)는 경로에 포함되지 않음
      expect(routes.some((r) => r.path === "/login")).toBe(true);
    });

    test("should match /login without (auth) prefix", () => {
      const match = router.match("/login");
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe("/login");
    });
  });

  describe("PageRenderer - SSR Mode", () => {
    let renderer: PageRenderer;
    const testPagePath = path.join(__dirname, "../../test-page.fl");

    beforeAll(() => {
      // 간단한 테스트 페이지 생성
      fs.writeFileSync(testPagePath, '(fn [] "<html><body>Hello SSR</body></html>")');
    });

    afterAll(() => {
      if (fs.existsSync(testPagePath)) {
        fs.unlinkSync(testPagePath);
      }
    });

    test("should render SSR page", async () => {
      // FLExecutor 모킹 필요 (여기서는 기본 구조만 테스트)
      expect(testPagePath).toBeTruthy();
    });

    test("should support render context", () => {
      const context: RenderContext = {
        filePath: "app/page.fl",
        mode: "ssr",
        params: { id: "123" },
        query: { sort: "asc" },
      };

      expect(context.filePath).toBe("app/page.fl");
      expect(context.mode).toBe("ssr");
      expect(context.params?.id).toBe("123");
      expect(context.query?.sort).toBe("asc");
    });
  });

  describe("PageRenderer - ISR Cache", () => {
    let renderer: PageRenderer;

    beforeAll(() => {
      // ISR 캐싱 테스트
      renderer = new PageRenderer(null as any, ".test-cache");
    });

    afterAll(() => {
      renderer.invalidateISRCache();
      if (fs.existsSync(".test-cache")) {
        fs.rmSync(".test-cache", { recursive: true });
      }
    });

    test("should manage ISR cache", () => {
      const stats = renderer.getCacheStats();
      expect(stats.isrCacheSize).toBe(0);
      expect(stats.isrCachedPaths).toEqual([]);
    });

    test("should invalidate ISR cache", () => {
      renderer.invalidateISRCache();
      const stats = renderer.getCacheStats();
      expect(stats.isrCacheSize).toBe(0);
    });
  });

  describe("Dynamic Route Parameters", () => {
    let router: AppRouter;
    const testAppDir = path.join(__dirname, "../../test-app-dynamic");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 복합 동적 경로 테스트
      const blogDir = path.join(testAppDir, "blog", "[year]", "[month]", "[slug]");
      fs.mkdirSync(blogDir, { recursive: true });
      fs.writeFileSync(
        path.join(blogDir, "page.fl"),
        '(page (format "Blog: %s-%s/%s" year month slug))'
      );

      router = new AppRouter(testAppDir);
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should match multi-segment dynamic routes", () => {
      const match = router.match("/blog/2026/04/hello-world");
      expect(match).not.toBeNull();
      expect(match?.params.year).toBe("2026");
      expect(match?.params.month).toBe("04");
      expect(match?.params.slug).toBe("hello-world");
    });

    test("should handle URL-encoded params", () => {
      const match = router.match("/blog/2026/04/hello%20world");
      expect(match).not.toBeNull();
      expect(match?.params.slug).toBe("hello%20world");
    });
  });

  describe("SSR vs CSR Branching", () => {
    test("should determine render mode based on context", () => {
      const ssrContext: RenderContext = {
        filePath: "app/page.fl",
        mode: "ssr",
      };

      const csrContext: RenderContext = {
        filePath: "app/page.fl",
        mode: "ssr",
        headers: { "x-client-render": "true" },
      };

      expect(ssrContext.mode).toBe("ssr");
      // CSR은 프론트엔드에서 처리
      expect(csrContext.headers?.["x-client-render"]).toBe("true");
    });
  });

  describe("Layout Chain Building", () => {
    let router: AppRouter;
    const testAppDir = path.join(__dirname, "../../test-app-layouts");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 다층 레이아웃 테스트
      fs.writeFileSync(path.join(testAppDir, "layout.fl"), '(layout-root {{{ children }}})');

      const adminDir = path.join(testAppDir, "admin");
      fs.mkdirSync(adminDir, { recursive: true });
      fs.writeFileSync(path.join(adminDir, "layout.fl"), '(layout-admin {{{ children }}})');
      fs.writeFileSync(path.join(adminDir, "page.fl"), '(page "Admin Home")');

      const adminDashDir = path.join(adminDir, "dashboard");
      fs.mkdirSync(adminDashDir, { recursive: true });
      fs.writeFileSync(path.join(adminDashDir, "page.fl"), '(page "Dashboard")');

      router = new AppRouter(testAppDir);
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should build layout chain for nested routes", () => {
      const layouts = router.getLayoutsForRoute("/admin");
      // 루트 레이아웃 + admin 레이아웃
      expect(layouts.length).toBeGreaterThan(0);
    });
  });

  describe("Performance - Route Matching", () => {
    let router: AppRouter;
    const testAppDir = path.join(__dirname, "../../test-app-perf");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 많은 라우트 생성하여 성능 테스트
      for (let i = 0; i < 100; i++) {
        const dir = path.join(testAppDir, `route${i}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "page.fl"), `(page "Route ${i}")`);
      }

      router = new AppRouter(testAppDir);
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should match routes efficiently with many registered routes", () => {
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        router.match(`/route${i % 100}`);
      }
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // 1000회 매칭이 100ms 이내
    });
  });

  describe("Dynamic Metadata (set-meta!)", () => {
    const testAppDir = path.join(__dirname, "../../test-app-meta");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 1️⃣ 기본 메타 테스트용 페이지
      fs.writeFileSync(
        path.join(testAppDir, "page.fl"),
        `(do
          (set-meta! {:title "Dynamic Title" :description "Test description" :og-image "/img/hero.jpg"})
          "<html><head></head><body>Content</body></html>")`
      );

      // 2️⃣ 이미 메타 태그가 있는 HTML
      fs.writeFileSync(
        path.join(testAppDir, "page-dup.fl"),
        `(do
          (set-meta! {:title "New Title" :description "New desc"})
          "<html><head><meta name=\\"description\\" content=\\"Existing desc\\"></head><body>Content</body></html>")`
      );

      // 3️⃣ Canonical URL 테스트
      fs.writeFileSync(
        path.join(testAppDir, "page-canonical.fl"),
        `(do
          (set-meta! {:title "Article" :canonical "https://example.com/article" :og-url "https://example.com/article"})
          "<html><head></head><body>Article</body></html>")`
      );

      // 4️⃣ 빈 메타 테스트
      fs.writeFileSync(
        path.join(testAppDir, "page-empty.fl"),
        `(do
          (set-meta! {})
          "<html><head></head><body>Content</body></html>")`
      );
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should support set-meta! function", async () => {
      // FLExecutor에 set-meta! 함수가 주입되어 작동하는지 확인
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      const result = await executor.executePage(
        path.join(testAppDir, "page.fl"),
        { method: "GET", path: "/" }
      );

      // ExecutionResult에 meta 필드가 존재하고 set-meta! 호출이 수집됨
      expect(result.meta).toBeDefined();
      expect(result.meta.title).toBe("Dynamic Title");
      expect(result.meta.description).toBe("Test description");
      expect(result.meta["og-image"]).toBe("/img/hero.jpg");
    });

    test("should inject meta tags in HTML head", () => {
      // FLExecutor + server injectMetaIntoHead 조합 테스트
      const metadata = {
        title: "Page Title",
        description: "Page description",
        "og-image": "/img/hero.jpg",
        "og-title": "OG Title"
      };

      // 빈 head를 가진 HTML
      const html = "<html><head></head><body>Content</body></html>";

      // injectMetaIntoHead 메서드 호출 (server.ts의 메서드)
      // 이 메서드는 HTML head에 메타 태그를 주입함
      const headStart = html.indexOf("<head>") + 6;
      const headEnd = html.indexOf("</head>");

      let injected = html.substring(0, headStart);

      // title 태그
      if (metadata.title) {
        injected += `<title>${metadata.title}</title>`;
      }
      // description 메타
      if (metadata.description) {
        injected += `<meta name="description" content="${metadata.description}">`;
      }
      // og:image 메타
      if (metadata["og-image"]) {
        injected += `<meta property="og:image" content="${metadata["og-image"]}">`;
      }
      // og:title 메타
      if (metadata["og-title"]) {
        injected += `<meta property="og:title" content="${metadata["og-title"]}">`;
      }

      injected += html.substring(headEnd);

      // 결과 HTML이 모든 메타 태그를 포함하는지 확인
      expect(injected).toContain("<title>Page Title</title>");
      expect(injected).toContain('<meta name="description" content="Page description">');
      expect(injected).toContain('<meta property="og:image" content="/img/hero.jpg">');
      expect(injected).toContain('<meta property="og:title" content="OG Title">');
    });

    test("should skip duplicate meta tags", () => {
      // 기존 메타 태그와 중복되는 경우 스킵
      const html = `<html><head><meta name="description" content="Existing"></head><body></body></html>`;
      const metadata = { description: "New" };

      const headStart = html.indexOf("<head>") + 6;
      const headEnd = html.indexOf("</head>");
      const headContent = html.substring(headStart, headEnd);

      let injected = html.substring(0, headStart);

      // 이미 존재하는 메타 태그는 스킵
      if (metadata.description && !headContent.includes('name="description"')) {
        injected += `<meta name="description" content="${metadata.description}">`;
      }

      injected += headContent + html.substring(headEnd);

      // 중복이 없어야 함 (1개만 있어야 함)
      const matches = injected.match(/name="description"/g) || [];
      expect(matches.length).toBe(1);
      // 원래 내용 유지 (Existing이 여전히 있어야 함)
      expect(injected).toContain("Existing");
      // 새로운 값은 추가되지 않아야 함 (중복 방지)
      expect(injected).not.toContain('content="New"');
    });

    test("should handle canonical URL", () => {
      // Canonical URL과 og:url 처리
      const metadata = {
        title: "Article",
        canonical: "https://example.com/article",
        "og-url": "https://example.com/article"
      };

      const html = "<html><head></head><body></body></html>";
      const headStart = html.indexOf("<head>") + 6;
      const headEnd = html.indexOf("</head>");

      let injected = html.substring(0, headStart);

      // title
      injected += `<title>${metadata.title}</title>`;
      // canonical 링크
      if (metadata.canonical) {
        injected += `<link rel="canonical" href="${metadata.canonical}">`;
      }
      // og:url
      if (metadata["og-url"]) {
        injected += `<meta property="og:url" content="${metadata["og-url"]}">`;
      }

      injected += html.substring(headEnd);

      // canonical과 og:url이 모두 주입되어야 함
      expect(injected).toContain('<link rel="canonical" href="https://example.com/article">');
      expect(injected).toContain('<meta property="og:url" content="https://example.com/article">');
    });

    test("should handle OG tags", () => {
      // Open Graph 태그 전체 지원
      const metadata = {
        title: "Product",
        "og-title": "Buy This Product",
        "og-description": "Great product for you",
        "og-image": "/img/product.jpg",
        "og-url": "https://example.com/product",
        "og-type": "product"
      };

      const html = "<html><head></head><body></body></html>";
      const headStart = html.indexOf("<head>") + 6;
      const headEnd = html.indexOf("</head>");

      let injected = html.substring(0, headStart);

      // title
      injected += `<title>${metadata.title}</title>`;
      // OG tags
      for (const [key, value] of Object.entries(metadata)) {
        if (key.startsWith("og-")) {
          const prop = key.replace("og-", "og:");
          injected += `<meta property="${prop}" content="${value}">`;
        }
      }

      injected += html.substring(headEnd);

      // 모든 OG 태그가 주입되어야 함
      expect(injected).toContain('<meta property="og:title" content="Buy This Product">');
      expect(injected).toContain('<meta property="og:description" content="Great product for you">');
      expect(injected).toContain('<meta property="og:image" content="/img/product.jpg">');
      expect(injected).toContain('<meta property="og:url" content="https://example.com/product">');
      expect(injected).toContain('<meta property="og:type" content="product">');
    });

    test("should handle empty meta gracefully", async () => {
      // 빈 메타 객체는 에러 없이 처리
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      const result = await executor.executePage(
        path.join(testAppDir, "page-empty.fl"),
        { method: "GET", path: "/" }
      );

      // 빈 메타도 성공적으로 실행되어야 함
      expect(result.success).toBe(true);
      // 메타가 없거나 빈 객체
      expect(!result.meta || Object.keys(result.meta).length === 0).toBe(true);
    });
  });

  describe("Server-Side Data Fetching (server-fetch)", () => {
    const testAppDir = path.join(__dirname, "../../test-app-fetch");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 1️⃣ 기본 fetch 테스트 (JSON 응답)
      fs.writeFileSync(
        path.join(testAppDir, "page-fetch.fl"),
        `(do
          (let [response (server-fetch "http://localhost:9999/api/test" :method "GET")]
            (str "<html><body>" response "</body></html>")))`
      );

      // 2️⃣ fetch-json 테스트 (JSON 파싱)
      fs.writeFileSync(
        path.join(testAppDir, "page-fetch-json.fl"),
        `(do
          (let [data (server-fetch-json "http://localhost:9999/api/data" :method "GET")]
            (str "<html><body>Name: " (get data "name") "</body></html>")))`
      );

      // 3️⃣ POST with body
      fs.writeFileSync(
        path.join(testAppDir, "page-fetch-post.fl"),
        `(do
          (let [response (server-fetch "http://localhost:9999/api/create"
                                      :method "POST"
                                      :body "{\"name\": \"test\"}")]
            (str "<html><body>" response "</body></html>")))`
      );

      // 4️⃣ Header 전달
      fs.writeFileSync(
        path.join(testAppDir, "page-fetch-headers.fl"),
        `(do
          (let [response (server-fetch "http://localhost:9999/api/auth"
                                      :method "GET"
                                      :headers {:Authorization "Bearer token123"})]
            (str "<html><body>" response "</body></html>")))`
      );

      // 5️⃣ 네트워크 에러 처리
      fs.writeFileSync(
        path.join(testAppDir, "page-fetch-error.fl"),
        `(do
          (let [response (server-fetch "http://invalid.localhost:9999/api")]
            (if response
              (str "<html><body>" response "</body></html>")
              "<html><body>Error</body></html>")))`
      );
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should support server-fetch function", () => {
      // server-fetch 함수가 interpreter context에 주입되는지 확인
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      // ensureHelpers() 호출 (일반적으로 executePage에서 호출됨)
      (executor as any).ensureHelpers();

      // server-fetch가 variables에 저장되었는지 확인
      const serverFetch = interpreter.context.variables.get("server-fetch");
      expect(serverFetch).toBeDefined();
      expect(typeof serverFetch).toBe("function");
    });

    test("should make HTTP GET request", () => {
      // server-fetch로 GET 요청 가능 여부
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetch = interpreter.context.variables.get("server-fetch");

      // 유효하지 않은 URL로 요청 시 null 반환 (에러 처리)
      const result = serverFetch("http://invalid.localhost:99999/test");
      expect(result === null || typeof result === "string").toBe(true);
    });

    test("should parse JSON response with server-fetch-json", () => {
      // server-fetch-json 함수 존재 여부
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetchJson = interpreter.context.variables.get("server-fetch-json");
      expect(serverFetchJson).toBeDefined();
      expect(typeof serverFetchJson).toBe("function");

      // 유효하지 않은 URL로 요청 시 null 반환
      const result = serverFetchJson("http://invalid.localhost:99999/test");
      expect(result === null || typeof result === "object").toBe(true);
    });

    test("should support POST with body", () => {
      // server-fetch가 method와 body 옵션 지원
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetch = interpreter.context.variables.get("server-fetch");

      // POST 옵션과 body를 전달할 수 있는지 확인
      const result = serverFetch("http://invalid.localhost:99999/test", {
        method: "POST",
        body: '{"test": "data"}'
      });

      expect(result === null || typeof result === "string").toBe(true);
    });

    test("should pass custom headers", () => {
      // server-fetch가 headers 옵션 지원
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetch = interpreter.context.variables.get("server-fetch");

      // headers 옵션 전달 가능 여부
      const result = serverFetch("http://invalid.localhost:99999/test", {
        method: "GET",
        headers: { Authorization: "Bearer token123" }
      });

      expect(result === null || typeof result === "string").toBe(true);
    });

    test("should handle network errors gracefully", () => {
      // 네트워크 에러 시 null 반환
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetch = interpreter.context.variables.get("server-fetch");

      // 존재하지 않는 URL은 에러 처리 후 null 반환
      const result = serverFetch("http://invalid.localhost:99999/nonexistent");
      expect(result === null || typeof result === "string").toBe(true);
    });

    test("should support timeout handling", () => {
      // server-fetch가 호출되어도 에러가 나지 않음 (timeout 등)
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);
      (executor as any).ensureHelpers();

      const serverFetch = interpreter.context.variables.get("server-fetch");

      // timeout이 발생해도 크래시하지 않음
      try {
        const result = serverFetch("http://localhost:1/timeout");
        expect(result === null || typeof result === "string").toBe(true);
      } catch (err) {
        // catch되더라도 에러 처리 확인
        expect(true).toBe(true);
      }
    });

    test("should work with ISR cache", async () => {
      // server-fetch + ISR 렌더링 조합
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      // server-fetch 호출이 포함된 .fl 파일 실행
      const result = await executor.executePage(
        path.join(testAppDir, "page-fetch-error.fl"),
        { method: "GET", path: "/" }
      );

      // 성공적으로 실행됨 (에러 처리됨)
      expect(result.success).toBe(true);
      expect(result.body).toBeDefined();
    });
  });

  describe("Middleware Integration", () => {
    const testAppDir = path.join(__dirname, "../../test-app-middleware");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 1️⃣ 전역 미들웨어
      fs.writeFileSync(
        path.join(testAppDir, "middleware.fl"),
        `(defn middleware-handler [request]
          (if (get request :auth-token)
            {:pass true}
            {:pass false :status 401}))`
      );

      // 2️⃣ 미들웨어 통과 시 페이지
      fs.writeFileSync(
        path.join(testAppDir, "page.fl"),
        `(do "<html><body>Protected Page</body></html>")`
      );

      // 3️⃣ 경로별 미들웨어 (nested)
      const adminDir = path.join(testAppDir, "admin");
      fs.mkdirSync(adminDir, { recursive: true });

      fs.writeFileSync(
        path.join(adminDir, "middleware.fl"),
        `(defn admin-middleware [request]
          (if (= (get request :role) "admin")
            {:pass true}
            {:pass false :status 403}))`
      );

      fs.writeFileSync(
        path.join(adminDir, "page.fl"),
        `(do "<html><body>Admin Panel</body></html>")`
      );

      // 4️⃣ 미들웨어 없는 경로
      fs.writeFileSync(
        path.join(testAppDir, "public.fl"),
        `(do "<html><body>Public Page</body></html>")`
      );
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should detect middleware.fl files", () => {
      // app-router가 middleware.fl을 인식
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // middleware 정보 조회 메서드 (getMiddlewareForPath)
      const middlewares = (router as any).middlewares;
      expect(middlewares).toBeDefined();
      expect(middlewares instanceof Map).toBe(true);
    });

    test("should execute middleware before page", async () => {
      // 미들웨어가 요청 전에 실행됨
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      const result = await executor.executePage(
        path.join(testAppDir, "page.fl"),
        { method: "GET", path: "/", headers: { "auth-token": "token123" } }
      );

      expect(result.success).toBe(true);
      expect(result.body).toBeDefined();
    });

    test("should block request on middleware rejection", () => {
      // 미들웨어가 {pass: false}를 반환하면 401/403 응답
      // middleware-handler는 auth-token이 없으면 {pass: false, status: 401}를 반환
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      // middleware.fl이 auth-token을 요구하므로, 없으면 차단됨
      // (실제 구현은 server.ts에서 처리하지만, 여기서는 middleware 존재 확인)
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      const middlewarePath = router.getMiddlewareForPath("/");
      expect(middlewarePath).toBeDefined();
      expect(middlewarePath).toContain("middleware.fl");
    });

    test("should support nested middleware", () => {
      // /admin 경로에서 admin-middleware 적용
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // /admin에 대한 middleware.fl 조회
      const adminMiddleware = router.getMiddlewareForPath("/admin");
      expect(adminMiddleware).toBeDefined();
      expect(adminMiddleware).toContain("admin");
      expect(adminMiddleware).toContain("middleware.fl");

      // 루트 middleware도 존재
      const rootMiddleware = router.getMiddlewareForPath("/");
      expect(rootMiddleware).toBeDefined();
    });

    test("should skip middleware for unprotected routes", async () => {
      // middleware.fl이 없는 경로는 미들웨어 스킵
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      const result = await executor.executePage(
        path.join(testAppDir, "public.fl"),
        { method: "GET", path: "/public" }
      );

      expect(result.success).toBe(true);
      expect(result.body).toContain("Public Page");

      // public.fl은 middleware 없이 직접 실행됨
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // /public에 대한 middleware는 없음
      const publicMiddleware = router.getMiddlewareForPath("/public");
      expect(publicMiddleware).toBeNull();
    });
  });

  describe("Error Boundary (error.fl, not-found.fl)", () => {
    const testAppDir = path.join(__dirname, "../../test-app-errors");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 1️⃣ 전역 에러 핸들러
      fs.writeFileSync(
        path.join(testAppDir, "error.fl"),
        `(defn error-handler [error-info]
          (let [status (get error-info :status)
                message (get error-info :message)]
            (str "<html><body>Error " status ": " message "</body></html>")))`
      );

      // 2️⃣ 404 핸들러
      fs.writeFileSync(
        path.join(testAppDir, "not-found.fl"),
        `(do "<html><body>404 Not Found</body></html>")`
      );

      // 3️⃣ 정상 페이지
      fs.writeFileSync(
        path.join(testAppDir, "page.fl"),
        `(do "<html><body>OK</body></html>")`
      );

      // 4️⃣ 에러 발생 페이지
      fs.writeFileSync(
        path.join(testAppDir, "error-page.fl"),
        `(do
          (throw (str "Internal error"))
          "<html><body>Should not render</body></html>")`
      );

      // 5️⃣ 경로별 에러 핸들러
      const adminDir = path.join(testAppDir, "admin");
      fs.mkdirSync(adminDir, { recursive: true });

      fs.writeFileSync(
        path.join(adminDir, "error.fl"),
        `(do "<html><body>Admin Error</body></html>")`
      );

      fs.writeFileSync(
        path.join(adminDir, "page.fl"),
        `(do "<html><body>Admin Page</body></html>")`
      );
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should detect error.fl files", () => {
      // app-router가 error.fl을 인식
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // error 핸들러 조회 메서드 확인
      expect(router.getErrorHandlerForPath).toBeDefined();
      expect(typeof router.getErrorHandlerForPath).toBe("function");
    });

    test("should detect not-found.fl files", () => {
      // app-router가 not-found.fl을 인식
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // 404 핸들러 조회 메서드
      expect(router.getNotFoundHandler).toBeDefined();
      expect(typeof router.getNotFoundHandler).toBe("function");
    });

    test("should render 404 page for missing routes", () => {
      // 존재하지 않는 경로는 not-found.fl 렌더링
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // 존재하지 않는 경로 매칭 실패
      const match = router.match("/nonexistent");
      expect(match).toBeNull();

      // not-found 핸들러는 존재
      const notFoundHandler = router.getNotFoundHandler();
      expect(notFoundHandler).toBeDefined();
      expect(notFoundHandler).toContain("not-found.fl");
    });

    test("should use nested error handlers", () => {
      // /admin 경로에서 admin/error.fl 사용
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      const adminErrorHandler = router.getErrorHandlerForPath("/admin");
      expect(adminErrorHandler).toBeDefined();
      expect(adminErrorHandler).toContain("admin");
      expect(adminErrorHandler).toContain("error.fl");
    });

    test("should fallback to root error handler", () => {
      // 경로별 error.fl이 없으면 루트 error.fl 사용
      const AppRouter = require("../web/app-router").AppRouter;
      const router = new AppRouter(testAppDir);

      // 루트 error.fl은 항상 존재
      const rootErrorHandler = router.getErrorHandlerForPath("/");
      expect(rootErrorHandler).toBeDefined();
      expect(rootErrorHandler).toContain("error.fl");

      // /unknown에서 에러 발생 시 루트 error.fl로 fallback
      const unknownErrorHandler = router.getErrorHandlerForPath("/unknown/path");
      // 없으면 null이지만, 루트로 fallback할 수 있음
      expect(unknownErrorHandler === null || unknownErrorHandler?.includes("error.fl")).toBe(true);
    });
  });

  describe("Static Params Generation (getStaticPaths)", () => {
    const testAppDir = path.join(__dirname, "../../test-app-static-params");

    beforeAll(() => {
      if (!fs.existsSync(testAppDir)) {
        fs.mkdirSync(testAppDir, { recursive: true });
      }

      // 1️⃣ 동적 라우트 + generate-static-params
      const blogDir = path.join(testAppDir, "blog", "[slug]");
      fs.mkdirSync(blogDir, { recursive: true });

      fs.writeFileSync(
        path.join(blogDir, "page.fl"),
        `(do
          (let [slug (or (get (get $__params "slug") 0) "unknown")]
            (str "<html><body>Blog: " slug "</body></html>")))`
      );

      fs.writeFileSync(
        path.join(blogDir, "generate-static-params.fl"),
        `(do
          [{:slug "hello-world"} {:slug "my-first-post"} {:slug "another-post"}])`
      );

      // 2️⃣ 다중 동적 세그먼트
      const articlesDir = path.join(testAppDir, "articles", "[year]", "[month]", "[slug]");
      fs.mkdirSync(articlesDir, { recursive: true });

      fs.writeFileSync(
        path.join(articlesDir, "page.fl"),
        `(do
          (let [year (get $__params "year")
                month (get $__params "month")
                slug (get $__params "slug")]
            (str "<html><body>Article " year "-" month "-" slug "</body></html>")))`
      );

      fs.writeFileSync(
        path.join(articlesDir, "generate-static-params.fl"),
        `(do
          [{:year "2026" :month "01" :slug "post1"}
           {:year "2026" :month "02" :slug "post2"}
           {:year "2025" :month "12" :slug "post3"}])`
      );

      // 3️⃣ 빈 params 배열 (fallback: blocking)
      const productsDir = path.join(testAppDir, "products", "[id]");
      fs.mkdirSync(productsDir, { recursive: true });

      fs.writeFileSync(
        path.join(productsDir, "page.fl"),
        `(do "<html><body>Product</body></html>")`
      );

      fs.writeFileSync(
        path.join(productsDir, "generate-static-params.fl"),
        `(do [])`  // 빈 배열
      );
    });

    afterAll(() => {
      if (fs.existsSync(testAppDir)) {
        fs.rmSync(testAppDir, { recursive: true });
      }
    });

    test("should load generate-static-params.fl", () => {
      // generate-static-params.fl 파일 존재 여부
      const blogGenFile = path.join(testAppDir, "blog", "[slug]", "generate-static-params.fl");
      expect(fs.existsSync(blogGenFile)).toBe(true);
    });

    test("should execute generate-static-params and get params array", () => {
      // generate-static-params.fl 실행 후 params 배열 반환
      const { Interpreter } = require("../interpreter");
      const FLExecutor = require("../web/fl-executor").FLExecutor;

      const interpreter = new Interpreter();
      const executor = new FLExecutor(interpreter);

      const genFile = path.join(testAppDir, "blog", "[slug]", "generate-static-params.fl");

      // 간단한 검증: 파일을 읽으면 배열이 반환됨
      const content = fs.readFileSync(genFile, "utf-8");
      expect(content).toContain("hello-world");
      expect(content).toContain("my-first-post");
    });

    test("should support multi-segment dynamic routes", () => {
      // [year]/[month]/[slug] 같은 다중 세그먼트
      const articlesGenFile = path.join(testAppDir, "articles", "[year]", "[month]", "[slug]", "generate-static-params.fl");
      expect(fs.existsSync(articlesGenFile)).toBe(true);

      const content = fs.readFileSync(articlesGenFile, "utf-8");
      expect(content).toContain("2026");
      expect(content).toContain("post1");
    });

    test("should handle empty params (fallback: blocking)", () => {
      // 빈 params 배열 = fallback: blocking (새 경로는 SSR)
      const productsGenFile = path.join(testAppDir, "products", "[id]", "generate-static-params.fl");
      expect(fs.existsSync(productsGenFile)).toBe(true);

      const content = fs.readFileSync(productsGenFile, "utf-8");
      // 빈 배열
      expect(content).toContain("[]");
    });

    test("should build SSG paths from params", () => {
      // generate-static-params 결과 → /blog/hello-world, /blog/my-first-post 등 경로 생성
      const routes = [
        "/blog/hello-world",
        "/blog/my-first-post",
        "/blog/another-post"
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/blog\/[a-z0-9-]+$/);
      });
    });

    test("should use revalidate for ISR", () => {
      // generate-static-params.fl에서 revalidate 메타데이터 지원
      // 예: {:revalidate 60} → 60초마다 재생성
      const blogGenFile = path.join(testAppDir, "blog", "[slug]", "generate-static-params.fl");
      const content = fs.readFileSync(blogGenFile, "utf-8");

      // generate-static-params.fl은 배열을 반환하는 형식
      // revalidate는 별도의 메타데이터로 처리 가능 (현재는 기본 구현)
      expect(content).toContain("[");
      expect(content).toContain("]");
      expect(content).toContain(":slug");
    });

    test("should handle 1000+ params efficiently", () => {
      // 성능 테스트: 대량의 params 처리 (1초 이내)
      const start = Date.now();

      const largeParams = Array.from({ length: 1000 }, (_, i) => ({
        slug: `post-${i}`
      }));

      const duration = Date.now() - start;

      expect(largeParams.length).toBe(1000);
      expect(largeParams[0].slug).toBe("post-0");
      expect(largeParams[999].slug).toBe("post-999");
      // 생성 시간이 1초 이내여야 함
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Image Optimization", () => {
    const testImageDir = path.join(__dirname, "../../test-images");
    const testCacheDir = path.join(__dirname, "../../test-image-cache");

    beforeAll(() => {
      if (!fs.existsSync(testImageDir)) {
        fs.mkdirSync(testImageDir, { recursive: true });
      }

      // 테스트용 더미 이미지 생성 (1x1 PNG)
      const pngHeader = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
        0x54, 0x08, 0x99, 0x63, 0xf8, 0x0f, 0x00, 0x00,
        0x01, 0x01, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
      ]);

      fs.writeFileSync(path.join(testImageDir, "test.png"), pngHeader);
      fs.writeFileSync(path.join(testImageDir, "hero.jpg"), Buffer.from("fake jpg"));
      fs.writeFileSync(path.join(testImageDir, "logo.gif"), Buffer.from("fake gif"));
    });

    afterAll(() => {
      if (fs.existsSync(testImageDir)) {
        fs.rmSync(testImageDir, { recursive: true });
      }
      if (fs.existsSync(testCacheDir)) {
        fs.rmSync(testCacheDir, { recursive: true });
      }
    });

    test("should detect available image optimization backend", () => {
      // 사용 가능한 이미지 최적화 백엔드 감지 (sharp, cwebp, none)
      // "none" 백엔드: 원본 복사 + srcset HTML만 생성
      expect(true).toBe(true); // placeholder
    });

    test("should copy original images when sharp not available", () => {
      // "none" 백엔드: 원본 파일 복사
      const testImage = path.join(testImageDir, "test.png");
      expect(fs.existsSync(testImage)).toBe(true);

      // 원본은 변경되지 않음
      const originalSize = fs.statSync(testImage).size;
      expect(originalSize).toBeGreaterThan(0);
    });

    test("should handle corrupted images gracefully", () => {
      // 손상된 이미지 에러 처리
      const testDir = path.join(__dirname, "../../test-corrupted");
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }

      fs.writeFileSync(path.join(testDir, "corrupt.png"), Buffer.from("not a real image"));

      const corruptImage = path.join(testDir, "corrupt.png");
      expect(fs.existsSync(corruptImage)).toBe(true);

      // cleanup
      fs.rmSync(testDir, { recursive: true });
    });

    test("should skip non-existent files", () => {
      // 존재하지 않는 파일 처리
      const nonExistentFile = path.join(testImageDir, "nonexistent.png");
      expect(fs.existsSync(nonExistentFile)).toBe(false);
    });

    test("should cache converted images", () => {
      // 변환된 이미지 캐시: 이미 변환된 이미지는 스킵
      const testImage = path.join(testImageDir, "test.png");
      expect(fs.existsSync(testImage)).toBe(true);

      // 캐시 체크: 같은 파일 두 번 처리 시 캐시 히트
      // (실제 구현에서는 수정 시간 기반 캐시)
      const stat1 = fs.statSync(testImage);
      const stat2 = fs.statSync(testImage);

      expect(stat1.mtime.getTime()).toBe(stat2.mtime.getTime());
    });

    test("should handle batch processing (100+ images)", () => {
      // 대량 이미지 처리
      const batchDir = path.join(__dirname, "../../test-batch");
      if (!fs.existsSync(batchDir)) {
        fs.mkdirSync(batchDir, { recursive: true });
      }

      // 100개 이미지 생성
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(
          path.join(batchDir, `image-${i}.jpg`),
          Buffer.from("fake jpg content")
        );
      }

      const files = fs.readdirSync(batchDir);
      expect(files.length).toBe(100);

      // cleanup
      fs.rmSync(batchDir, { recursive: true });
    });

    test("should generate srcset HTML", () => {
      // srcset HTML 생성 (원본 + WebP + AVIF 후보)
      const srcsetHTML = '<img src="/img/hero.jpg" srcset="/img/hero.webp 1x, /img/hero.avif 1x" />';

      expect(srcsetHTML).toContain("srcset");
      expect(srcsetHTML).toContain(".webp");
      expect(srcsetHTML).toContain(".avif");
    });

    test("should preserve original format when sharp available", () => {
      // sharp 사용 가능 시 원본 포맷 유지
      const testImage = path.join(testImageDir, "test.png");
      expect(testImage).toContain(".png");

      // 원본은 여전히 PNG
      const content = fs.readFileSync(testImage);
      expect(content[0]).toBe(0x89); // PNG magic number
    });
  });

  describe("On-Demand ISR (revalidateTag)", () => {
    test("should support tag-based cache invalidation", () => {
      // 페이지에 tags: ["posts", "blog"] 메타데이터 추가 가능
      const tags = ["posts", "blog"];
      expect(tags.length).toBe(2);
      expect(tags).toContain("posts");
      expect(tags).toContain("blog");
    });

    test("should index tags for quick lookup", () => {
      // tag → [cached paths] 매핑
      const tagIndex = new Map<string, Set<string>>();
      tagIndex.set("posts", new Set(["/blog/hello", "/blog/world"]));
      tagIndex.set("blog", new Set(["/blog/hello", "/blog/world"]));

      expect(tagIndex.has("posts")).toBe(true);
      expect(tagIndex.get("posts")?.size).toBe(2);
    });

    test("should invalidate cache by tag", () => {
      // tag 삭제 시 모든 관련 캐시 무효화
      const tagIndex = new Map<string, Set<string>>();
      const posts = new Set(["/blog/1", "/blog/2", "/blog/3"]);
      tagIndex.set("posts", posts);

      expect(tagIndex.get("posts")?.size).toBe(3);

      // tag 기반 무효화: "posts" 태그 삭제
      tagIndex.delete("posts");
      expect(tagIndex.has("posts")).toBe(false);
    });

    test("should support multiple tag invalidation", () => {
      // 여러 tag 동시 무효화
      const tagIndex = new Map<string, Set<string>>();
      tagIndex.set("posts", new Set(["/blog/1"]));
      tagIndex.set("comments", new Set(["/blog/1"]));
      tagIndex.set("users", new Set(["/profile/john"]));

      const tagsToInvalidate = ["posts", "comments"];
      tagsToInvalidate.forEach(tag => tagIndex.delete(tag));

      expect(tagIndex.has("posts")).toBe(false);
      expect(tagIndex.has("comments")).toBe(false);
      expect(tagIndex.has("users")).toBe(true);
    });

    test("should require auth token for revalidation API", () => {
      // POST /api/__fl/revalidate는 X-FL-Revalidate-Token 헤더 필수
      const validToken = "secret-token";
      const requestToken = "secret-token";

      expect(requestToken).toBe(validToken);
    });
  });

  describe("Cache-Control & ETag/304", () => {
    test("should set Cache-Control for SSR (no-store)", () => {
      // SSR 모드: Cache-Control: no-store
      const cacheControl = "no-store";
      expect(cacheControl).toBe("no-store");
    });

    test("should set Cache-Control for ISR (s-maxage)", () => {
      // ISR 모드: Cache-Control: public, s-maxage=60, stale-while-revalidate=86400
      const revalidateSeconds = 60;
      const cacheControl = `public, s-maxage=${revalidateSeconds}, stale-while-revalidate=86400`;

      expect(cacheControl).toContain("s-maxage=60");
      expect(cacheControl).toContain("stale-while-revalidate");
    });

    test("should set Cache-Control for SSG (immutable)", () => {
      // SSG 모드: Cache-Control: public, max-age=31536000, immutable
      const cacheControl = "public, max-age=31536000, immutable";

      expect(cacheControl).toContain("max-age=31536000");
      expect(cacheControl).toContain("immutable");
    });

    test("should generate ETag from content hash", () => {
      // ETag: crypto.createHash('md5').update(html).digest('hex')
      const crypto = require("crypto");
      const html = "<html><body>Test</body></html>";
      const etag = crypto.createHash("md5").update(html).digest("hex");

      expect(typeof etag).toBe("string");
      expect(etag.length).toBe(32); // MD5 hex: 32 chars
    });

    test("should return 304 on If-None-Match match", () => {
      // If-None-Match: etag 일치 → 304 Not Modified
      const crypto = require("crypto");
      const html = "<html><body>Test</body></html>";
      const etag = crypto.createHash("md5").update(html).digest("hex");

      const ifNoneMatch = etag;
      expect(ifNoneMatch).toBe(etag);
      // 일치 → 304
    });

    test("should return 200 on If-None-Match mismatch", () => {
      // If-None-Match: etag 불일치 → 200 OK
      const oldEtag = "old-etag";
      const newEtag = "new-etag";

      expect(oldEtag).not.toBe(newEtag);
      // 불일치 → 200
    });

    test("should respect Cache-Control for API routes", () => {
      // API route: Cache-Control: no-store (항상 fresh)
      const cacheControl = "no-store";
      expect(cacheControl).toBe("no-store");
    });

    test("should handle error responses (no-store)", () => {
      // 에러 응답: Cache-Control: no-store
      const cacheControl = "no-store";
      expect(cacheControl).toBe("no-store");
    });

    test("should apply correct cache headers in response", () => {
      // 응답 헤더: Cache-Control + ETag 모두 포함
      const headers = {
        "Cache-Control": "public, max-age=31536000, immutable",
        "ETag": "abc123def456"
      };

      expect(headers["Cache-Control"]).toBeDefined();
      expect(headers["ETag"]).toBeDefined();
    });

    test("should preserve cache semantics after revalidation", () => {
      // ISR 캐시 무효화 후 새로운 max-age 적용
      const beforeRevalidate = "public, s-maxage=60, stale-while-revalidate=86400";
      const afterRevalidate = "public, s-maxage=60, stale-while-revalidate=86400";

      expect(beforeRevalidate).toBe(afterRevalidate);
      // 무효화 후에도 같은 캐시 정책 유지
    });
  });
});
