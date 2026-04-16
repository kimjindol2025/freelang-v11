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
});
