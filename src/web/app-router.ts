/**
 * FreeLang v11 - App Router (FileSystem-based Routing)
 * 파일시스템 기반 라우팅 엔진
 * 변환 대상: freelang-frontend-v9/serve-router.js
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Route structure
 * {
 *   path: '/users/[id]',
 *   pattern: /^\/users\/([^/]+)$/,
 *   params: ['id'],
 *   filePath: 'app/users/[id]/page.fl',
 *   isDynamic: true,
 *   layouts: ['app/layout.fl', 'app/users/layout.fl']
 * }
 */

export interface LayoutChain {
  [path: string]: string[];
}

export interface Route {
  path: string;
  pattern: RegExp;
  filePath: string;
  params: string[];
  isDynamic: boolean;
  layouts: string[];
  kind?: "page" | "route";
}

export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}

/**
 * AppRouter: 파일시스템 기반 라우트 스캔 및 매칭
 */
export class AppRouter {
  private appDir: string;
  private routes: Route[] = [];
  private layoutChain: LayoutChain = {};
  private middlewares: Map<string, string> = new Map(); // W3: 경로 → middleware.fl 파일
  private errorHandlers: Map<string, string> = new Map(); // W4: 경로 → error.fl 파일
  private notFoundHandler: string | null = null; // W4: not-found.fl 파일

  constructor(appDir: string = "app") {
    this.appDir = appDir;
    this.scan();
  }

  /**
   * W4: not-found.fl 스캔
   */
  private scanNotFound(dir: string): void {
    try {
      const notFoundPath = path.join(dir, "not-found.fl");
      if (fs.existsSync(notFoundPath)) {
        this.notFoundHandler = notFoundPath;
        console.log(`approuter.not-found file=${notFoundPath}`);
      }
    } catch (err: any) {
      // ignore
    }
  }

  /**
   * 파일시스템 스캔 시작
   */
  private scan(): void {
    if (!fs.existsSync(this.appDir)) {
      console.log(`approuter.warn event=app_dir_missing path=${this.appDir}`);
      return;
    }

    // Five-pass scan: layouts, middlewares, error handlers, not-found, then pages
    // W3: middleware.fl, W4: error.fl/not-found.fl 스캔 추가
    this.scanDirectory(this.appDir, "", "layout");
    this.scanDirectory(this.appDir, "", "middleware");  // W3: middleware 스캔
    this.scanDirectory(this.appDir, "", "error");       // W4: error 스캔
    this.scanNotFound(this.appDir);                     // W4: not-found.fl 스캔
    this.scanDirectory(this.appDir, "", "page");
    this.scanDirectory(this.appDir, "", "route");
    this.buildLayoutChain();
  }

  /**
   * Recursive directory scan.
   * @param phase "layout" = register only layout.fl files;
   *              "page" = register only page.fl files (so layouts exist first)
   */
  private scanDirectory(dir: string, currentPath: string = "", phase: "layout" | "page" | "route" = "page"): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const nextPath =
          currentPath === ""
            ? "/" + entry.name
            : currentPath + "/" + entry.name;

        if (entry.isDirectory()) {
          const isRouteGroup =
            entry.name.startsWith("(") && entry.name.endsWith(")");
          const pathForChild = isRouteGroup ? currentPath : nextPath;
          this.scanDirectory(fullPath, pathForChild, phase);
        } else if (phase === "page" && entry.name === "page.fl") {
          const routePath = currentPath === "" ? "/" : currentPath;
          this.registerRoute(routePath, fullPath, "page");
        } else if (phase === "route" && entry.name === "route.fl") {
          const routePath = currentPath === "" ? "/" : currentPath;
          this.registerRoute(routePath, fullPath, "route");
        } else if (phase === "layout" && entry.name === "layout.fl") {
          const layoutPath = currentPath === "" ? "/" : currentPath;
          if (!this.layoutChain[layoutPath]) {
            this.layoutChain[layoutPath] = [];
          }
          this.layoutChain[layoutPath].push(fullPath);
          console.log(`approuter.layout scope=${layoutPath} file=${fullPath}`);
        } else if (phase === "middleware" && entry.name === "middleware.fl") {
          // W3: middleware.fl 등록
          const middlewarePath = currentPath === "" ? "/" : currentPath;
          this.middlewares.set(middlewarePath, fullPath);
          console.log(`approuter.middleware scope=${middlewarePath} file=${fullPath}`);
        } else if (phase === "error" && entry.name === "error.fl") {
          // W4: error.fl 등록
          const errorPath = currentPath === "" ? "/" : currentPath;
          this.errorHandlers.set(errorPath, fullPath);
          console.log(`approuter.error scope=${errorPath} file=${fullPath}`);
        }
      }
    } catch (err: any) {
      console.error(`Error scanning directory ${dir}:`, err.message);
    }
  }

  /**
   * 라우트 등록
   */
  private registerRoute(routePath: string, filePath: string, kind: "page" | "route" = "page"): void {
    // /users/[id] → /^\/users\/([^/]+)$/
    const pattern = this.buildPattern(routePath);
    const params = this.extractParams(routePath);
    const isDynamic = routePath.includes("[");

    const route: Route = {
      path: routePath,
      pattern,
      filePath,
      params,
      isDynamic,
      layouts: kind === "route" ? [] : this.getLayoutsForPath(routePath),
      kind,
    };

    this.routes.push(route);
    console.log(`approuter.${kind} path=${routePath} file=${filePath} dynamic=${isDynamic}`);
  }

  /**
   * [id] 문법을 정규표현식으로 변환
   * /users/[id] → /^\/users\/([^/]+)$/
   */
  private buildPattern(routePath: string): RegExp {
    const escaped = routePath
      .split("/")
      .map((segment) => {
        if (segment.startsWith("[") && segment.endsWith("]")) {
          // [id] → ([^/]+)
          return "([^/]+)";
        }
        // 일반 세그먼트 → escape
        return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("\\/");

    return new RegExp(`^${escaped}$`);
  }

  /**
   * 라우트에서 파라미터 이름 추출
   * /users/[id] → ['id']
   */
  private extractParams(routePath: string): string[] {
    const matches = routePath.match(/\[([^\]]+)\]/g);
    return matches ? matches.map((m) => m.slice(1, -1)) : [];
  }

  /**
   * 라우트에 대한 레이아웃 체인 구성 (루트 → 부모 → 현재)
   */
  private getLayoutsForPath(routePath: string): string[] {
    const layouts: string[] = [];
    const segments = routePath.split("/").filter(Boolean);

    // 루트 레이아웃 추가
    if (this.layoutChain["/"] || this.layoutChain[""]) {
      layouts.push(...(this.layoutChain["/"] || this.layoutChain[""] || []));
    }

    // 각 세그먼트별 레이아웃 추가
    let currentPath = "";
    for (const segment of segments) {
      currentPath += "/" + segment;
      if (this.layoutChain[currentPath]) {
        layouts.push(...this.layoutChain[currentPath]);
      }
    }

    return layouts;
  }

  /**
   * 레이아웃 체인 정렬 (깊이 기반)
   */
  private buildLayoutChain(): void {
    // 현재 구현에서는 이미 sorted
    // 필요시 깊이순 정렬 추가 가능
  }

  /**
   * URL 경로와 매칭 및 파라미터 추출
   */
  match(pathname: string): RouteMatch | null {
    for (const route of this.routes) {
      const match = pathname.match(route.pattern);
      if (match) {
        const params: Record<string, string> = {};
        route.params.forEach((param, index) => {
          params[param] = match[index + 1];
        });

        return { route, params };
      }
    }
    return null;
  }

  /**
   * 등록된 모든 라우트 반환 (디버깅용)
   */
  getRoutes(): Route[] {
    return this.routes;
  }

  /**
   * W3: 특정 경로에 대한 미들웨어 파일 조회
   */
  getMiddlewareForPath(routePath: string): string | null {
    return this.middlewares.get(routePath) || null;
  }

  /**
   * W4: 특정 경로에 대한 에러 핸들러 파일 조회
   */
  getErrorHandlerForPath(routePath: string): string | null {
    // 경로별 error.fl이 있으면 반환, 없으면 부모 경로 확인
    if (this.errorHandlers.has(routePath)) {
      return this.errorHandlers.get(routePath) || null;
    }
    // 루트 error.fl 반환
    return this.errorHandlers.get("/") || null;
  }

  /**
   * W4: 404 핸들러 파일 조회
   */
  getNotFoundHandler(): string | null {
    return this.notFoundHandler;
  }

  /**
   * 특정 경로에 대한 레이아웃 체인 조회
   */
  getLayoutsForRoute(routePath: string): string[] {
    return this.layoutChain[routePath] || [];
  }
}

export default AppRouter;
