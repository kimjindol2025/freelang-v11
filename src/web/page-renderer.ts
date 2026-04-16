/**
 * FreeLang v11 - Page Renderer (SSR/ISR/SSG)
 * 3가지 렌더링 모드 지원
 */

import * as fs from "fs";
import * as path from "path";
import FLExecutor from "./fl-executor";

export type RenderMode = "ssr" | "isr" | "ssg";

export interface RenderContext {
  filePath: string;
  mode: RenderMode;
  params?: Record<string, string>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: string;
  revalidateAfter?: number; // ISR: 재생성 주기 (초)
}

export interface RenderResult {
  html: string;
  meta?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
  timestamp: number;
  cached: boolean;
  cacheAge?: number;
}

/**
 * 페이지 렌더러
 * SSR: Server-Side Rendering (매번 실행)
 * ISR: Incremental Static Regeneration (캐시 + 주기적 재생성)
 * SSG: Static Site Generation (빌드 시점 미리 생성)
 */
export class PageRenderer {
  private executor: FLExecutor;
  private ssrCache: Map<
    string,
    { html: string; timestamp: number; revalidate?: number }
  > = new Map();
  private buildOutputDir: string = ".next";

  constructor(executor: FLExecutor, buildOutputDir?: string) {
    this.executor = executor;
    if (buildOutputDir) {
      this.buildOutputDir = buildOutputDir;
    }
  }

  /**
   * 페이지 렌더링 (모드별)
   */
  async render(context: RenderContext): Promise<RenderResult> {
    switch (context.mode) {
      case "ssr":
        return this.renderSSR(context);
      case "isr":
        return this.renderISR(context);
      case "ssg":
        return this.renderSSG(context);
      default:
        throw new Error(`Unknown render mode: ${context.mode}`);
    }
  }

  /**
   * SSR: 매번 서버에서 렌더링
   */
  private async renderSSR(context: RenderContext): Promise<RenderResult> {
    const startTime = Date.now();

    const result = await this.executor.executePage(context.filePath, {
      req: { method: "GET", path: "/" },
      params: context.params,
      query: context.query,
      headers: context.headers,
      body: context.body,
    });

    if (!result.success) {
      throw new Error(`Failed to render page: ${result.error}`);
    }

    const html =
      typeof result.body === "string"
        ? result.body
        : JSON.stringify(result.body);

    return {
      html,
      timestamp: Date.now(),
      cached: false,
      cacheAge: Date.now() - startTime,
    };
  }

  /**
   * ISR: 캐시 된 페이지 반환, 백그라운드에서 재생성
   */
  private async renderISR(context: RenderContext): Promise<RenderResult> {
    const cacheKey = this.getCacheKey(context.filePath, context.params);
    const revalidateAfter = context.revalidateAfter || 60; // 기본값: 60초

    // 캐시 조회
    const cached = this.ssrCache.get(cacheKey);
    if (
      cached &&
      Date.now() - cached.timestamp < revalidateAfter * 1000
    ) {
      return {
        html: cached.html,
        timestamp: cached.timestamp,
        cached: true,
        cacheAge: Date.now() - cached.timestamp,
      };
    }

    // 캐시 만료 또는 존재하지 않음 → 재생성
    const result = await this.renderSSR(context);

    // 새 캐시 저장
    this.ssrCache.set(cacheKey, {
      html: result.html,
      timestamp: result.timestamp,
      revalidate: revalidateAfter,
    });

    return {
      ...result,
      cached: false,
    };
  }

  /**
   * SSG: 빌드 시점에 정적 HTML 생성
   */
  private async renderSSG(context: RenderContext): Promise<RenderResult> {
    const cacheKey = this.getCacheKey(context.filePath, context.params);
    const outputPath = path.join(
      this.buildOutputDir,
      cacheKey.replace(/\//g, "_") + ".html"
    );

    // 이미 생성된 파일 확인
    if (fs.existsSync(outputPath)) {
      const html = fs.readFileSync(outputPath, "utf-8");
      const stat = fs.statSync(outputPath);
      return {
        html,
        timestamp: stat.mtime.getTime(),
        cached: true,
        cacheAge: Date.now() - stat.mtime.getTime(),
      };
    }

    // 빌드 시점에 생성
    const result = await this.renderSSR(context);

    // 출력 디렉토리 생성
    if (!fs.existsSync(this.buildOutputDir)) {
      fs.mkdirSync(this.buildOutputDir, { recursive: true });
    }

    // HTML 저장
    fs.writeFileSync(outputPath, result.html, "utf-8");

    return result;
  }

  /**
   * 레이아웃 래핑 (root layout + page)
   */
  async renderWithLayout(
    pageHtml: string,
    layoutChain: string[]
  ): Promise<string> {
    let html = pageHtml;

    // 레이아웃 체인을 역순으로 적용 (부모 → 자식)
    for (const layoutPath of [...layoutChain].reverse()) {
      const layoutResult = await this.executor.executePage(layoutPath, {
        req: { method: "GET", path: "/" },
      });

      if (layoutResult.success && typeof layoutResult.body === "string") {
        // 레이아웃이 <Outlet /> 또는 {{{ children }}} 같은 플레이스홀더 포함
        html = layoutResult.body.replace(
          /(<Outlet\s*\/>|{{{.*?children.*?}}})/,
          html
        );
      }
    }

    return html;
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(
    filePath: string,
    params?: Record<string, string>
  ): string {
    let key = filePath;
    if (params && Object.keys(params).length > 0) {
      const paramStr = Object.entries(params)
        .sort()
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
      key += `?${paramStr}`;
    }
    return key;
  }

  /**
   * ISR 캐시 전체 비우기
   */
  invalidateISRCache(): void {
    this.ssrCache.clear();
  }

  /**
   * 특정 경로의 ISR 캐시 비우기
   */
  invalidateISRPath(filePath: string, params?: Record<string, string>): void {
    const cacheKey = this.getCacheKey(filePath, params);
    this.ssrCache.delete(cacheKey);
  }

  /**
   * SSG 빌드 (모든 경로 정적 생성)
   */
  async buildSSG(routes: Array<{ filePath: string; params?: Record<string, string>[] }>): Promise<number> {
    let count = 0;

    for (const route of routes) {
      const paramSets = route.params || [{}];

      for (const params of paramSets) {
        try {
          await this.renderSSG({
            filePath: route.filePath,
            mode: "ssg",
            params,
          });
          count++;
        } catch (err: any) {
          console.error(`Failed to build ${route.filePath}:`, err.message);
        }
      }
    }

    return count;
  }

  /**
   * 캐시 상태 조회
   */
  getCacheStats(): {
    isrCacheSize: number;
    isrCachedPaths: string[];
  } {
    return {
      isrCacheSize: this.ssrCache.size,
      isrCachedPaths: Array.from(this.ssrCache.keys()),
    };
  }
}

export default PageRenderer;
