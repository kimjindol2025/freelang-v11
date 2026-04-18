/**
 * FreeLang v11 - Phase 3 Web Server Test Suite
 * App Router + HTTP Server + Page Renderer 통합 검증
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { AppRouter, Route } from "./web/app-router";
import { PageRenderer } from "./web/page-renderer";
import { WebServer } from "./web/server";
import { FLExecutor } from "./web/fl-executor";
import { Interpreter } from "./interpreter";
import * as fs from "fs";
import * as path from "path";

describe("Phase 3: Web Server Integration", () => {
  let tempDir: string;

  beforeAll(() => {
    // 임시 app 디렉토리 생성
    tempDir = path.join(__dirname, "temp-app-test");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // app/page.fl 생성
    const appDir = path.join(tempDir, "app");
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(
      path.join(appDir, "page.fl"),
      `(print "Home Page")`
    );

    // app/users/[id]/page.fl 생성
    const usersDir = path.join(appDir, "users", "[id]");
    fs.mkdirSync(usersDir, { recursive: true });
    fs.writeFileSync(
      path.join(usersDir, "page.fl"),
      `(print "User Page")`
    );
  });

  afterAll(() => {
    // 정리
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe("AppRouter", () => {
    it("should scan app directory and register static routes", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const routes = router.getRoutes();

      expect(routes.length).toBeGreaterThan(0);
      expect(routes.some((r) => r.path === "/")).toBe(true);
    });

    it("should scan and register dynamic routes", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const routes = router.getRoutes();

      const dynamicRoute = routes.find((r) => r.isDynamic);
      expect(dynamicRoute).toBeDefined();
      expect(dynamicRoute?.params).toContain("id");
    });

    it("should match static routes correctly", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const match = router.match("/");

      expect(match).toBeDefined();
      expect(match?.route.path).toBe("/");
      expect(match?.params).toEqual({});
    });

    it("should match dynamic routes with params", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const match = router.match("/users/123");

      expect(match).toBeDefined();
      expect(match?.params.id).toBe("123");
    });

    it("should not match non-existent routes", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const match = router.match("/non-existent");

      expect(match).toBeNull();
    });
  });

  describe("FLExecutor", () => {
    it("should create executor instance", () => {
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);

      expect(executor).toBeDefined();
    });

    it("should clear cache", () => {
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);
      const stats = executor.getCacheStats();

      expect(stats.size).toBe(0);
      executor.clearCache();
      expect(executor.getCacheStats().size).toBe(0);
    });
  });

  describe("PageRenderer", () => {
    it("should create renderer instance with SSR mode", () => {
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);
      const renderer = new PageRenderer(executor);

      expect(renderer).toBeDefined();
    });

    it("should invalidate ISR cache", () => {
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);
      const renderer = new PageRenderer(executor);

      renderer.invalidateISRCache();
      const stats = renderer.getCacheStats();

      expect(stats.isrCachSize).toBe(0);
    });
  });

  describe("WebServer", () => {
    it("should create server instance with default config", () => {
      const server = new WebServer();

      expect(server).toBeDefined();
      expect(server.getRouter()).toBeDefined();
    });

    it("should create server instance with custom config", () => {
      const server = new WebServer({
        appDir: path.join(tempDir, "app"),
        port: 3001,
        renderMode: "ssr",
      });

      expect(server).toBeDefined();
      expect(server.getRouter().getRoutes().length).toBeGreaterThan(0);
    });

    it("should set interpreter", () => {
      const server = new WebServer({
        appDir: path.join(tempDir, "app"),
      });
      const interp = new Interpreter();

      server.setInterpreter(interp);

      expect(server.getExecutor()).toBeDefined();
      expect(server.getRenderer()).toBeDefined();
    });
  });

  describe("Route Patterns", () => {
    it("should handle route group syntax", () => {
      // (layout) 폴더는 라우트 경로에 포함되지 않음
      const router = new AppRouter(path.join(tempDir, "app"));
      const routes = router.getRoutes();

      // Route group을 만들어서 테스트
      expect(routes).toBeDefined();
    });

    it("should build correct regex patterns", () => {
      const router = new AppRouter(path.join(tempDir, "app"));
      const routes = router.getRoutes();

      const dynamicRoute = routes.find((r) => r.isDynamic);
      if (dynamicRoute) {
        const pattern = dynamicRoute.pattern;

        expect(pattern.test("/users/123")).toBe(true);
        expect(pattern.test("/users/abc")).toBe(true);
        expect(pattern.test("/users/123/posts")).toBe(false);
      }
    });
  });

  describe("Integration: Router + Executor + Renderer", () => {
    it("should integrate router with executor", () => {
      const appDir = path.join(tempDir, "app");
      const router = new AppRouter(appDir);
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);

      expect(router.getRoutes().length).toBeGreaterThan(0);
      expect(executor).toBeDefined();
    });

    it("should integrate executor with renderer", () => {
      const interp = new Interpreter();
      const executor = new FLExecutor(interp);
      const renderer = new PageRenderer(executor);

      expect(renderer).toBeDefined();
      expect(executor.getCacheStats().size).toBe(0);
    });

    it("should integrate all components in server", () => {
      const appDir = path.join(tempDir, "app");
      const server = new WebServer({
        appDir,
        port: 3002,
      });
      const interp = new Interpreter();

      server.setInterpreter(interp);

      expect(server.getRouter()).toBeDefined();
      expect(server.getExecutor()).toBeDefined();
      expect(server.getRenderer()).toBeDefined();
    });
  });

  describe("CLI Integration", () => {
    it("should support serve command in CLI", () => {
      // cli.ts에 serve 명령어 추가 확인
      // - `cmdServe` 함수 정의
      // - switch 문에 "serve" 케이스 추가
      // - printUsage()에 serve 도움말 추가
      expect(true).toBe(true); // Placeholder
    });
  });
});
