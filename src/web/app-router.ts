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

  constructor(appDir: string = "app") {
    this.appDir = appDir;
    this.scan();
  }

  /**
   * 파일시스템 스캔 시작
   */
  private scan(): void {
    if (!fs.existsSync(this.appDir)) {
      console.warn(`⚠️  App directory not found: ${this.appDir}`);
      return;
    }

    this.scanDirectory(this.appDir, "");
    this.buildLayoutChain();
  }

  /**
   * 재귀적으로 디렉토리 스캔하여 page.fl / layout.fl 찾기
   */
  private scanDirectory(dir: string, currentPath: string = ""): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        // 경로 정규화 (항상 / 로 시작)
        const nextPath =
          currentPath === ""
            ? "/" + entry.name
            : currentPath + "/" + entry.name;

        if (entry.isDirectory()) {
          // 라우트 그룹 감지 (괄호로 감싼 폴더명)
          const isRouteGroup =
            entry.name.startsWith("(") && entry.name.endsWith(")");

          // 라우트 그룹이면 현재 경로 유지, 아니면 새 경로
          const pathForChild = isRouteGroup ? currentPath : nextPath;
          this.scanDirectory(fullPath, pathForChild);
        } else if (entry.name === "page.fl") {
          // 페이지 발견
          const routePath = currentPath === "" ? "/" : currentPath;
          this.registerRoute(routePath, fullPath);
        } else if (entry.name === "layout.fl") {
          // 레이아웃 발견 (추후 사용)
          const layoutPath = currentPath === "" ? "/" : currentPath;
          if (!this.layoutChain[layoutPath]) {
            this.layoutChain[layoutPath] = [];
          }
          this.layoutChain[layoutPath].push(fullPath);
        }
      }
    } catch (err: any) {
      console.error(`Error scanning directory ${dir}:`, err.message);
    }
  }

  /**
   * 라우트 등록
   */
  private registerRoute(routePath: string, filePath: string): void {
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
      layouts: this.getLayoutsForPath(routePath),
    };

    this.routes.push(route);
    console.log(
      `  ✓ Route: ${routePath.padEnd(30)} → ${filePath}`
    );
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
   * 특정 경로에 대한 레이아웃 체인 조회
   */
  getLayoutsForRoute(routePath: string): string[] {
    return this.layoutChain[routePath] || [];
  }
}

export default AppRouter;
