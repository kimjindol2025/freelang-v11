/**
 * FreeLang v11 - Web Server with App Router
 * 앱 라우터를 통한 동적 라우팅 + 레거시 데모 라우트
 * 변환 대상: freelang-frontend-v9/serve.js
 */

import * as http from "http";
import * as path from "path";
import { AppRouter, Route, RouteMatch } from "./app-router";
import FLExecutor from "./fl-executor";
import PageRenderer from "./page-renderer";
import { Interpreter } from "../interpreter";

/**
 * HTML 이스케이프: XSS 방지
 */
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export interface ServerConfig {
  appDir?: string;
  port?: number;
  renderMode?: "ssr" | "isr" | "ssg";
}

/**
 * HTML 페이지 생성 헬퍼
 */
function generatePageHTML(route: Route, params: Record<string, string> = {}): string {
  const title = route.filePath || "Page";
  let content = `<h1>${title}</h1>`;

  // 라우트 파라미터 표시
  if (Object.keys(params).length > 0) {
    content += "<p><strong>Route Parameters:</strong></p><ul>";
    for (const [key, value] of Object.entries(params)) {
      content += `<li>${key}: ${value}</li>`;
    }
    content += "</ul>";
  }

  return generateHTML(title, content);
}

/**
 * 풀 HTML 페이지 생성
 */
function generateHTML(title: string, content: string, extraCss: string = ""): string {
  const defaultCss = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      padding: 40px;
      max-width: 600px;
      width: 100%;
    }
    h1 { color: #667eea; margin-bottom: 20px; }
    p { color: #666; margin-bottom: 15px; }
    ul { margin-left: 20px; }
    li { margin-bottom: 10px; }
    a { color: #667eea; text-decoration: none; }
    a:hover { text-decoration: underline; }`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreeLang v11 - ${title}</title>
  <style>
${defaultCss}
${extraCss ? "\n" + extraCss : ""}
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
    <p><small>Powered by FreeLang v11 App Router</small></p>
    <p><a href="/">← Back to Home</a></p>
  </div>
</body>
</html>`;
}

/**
 * 홈페이지 생성
 */
function generateIndexHTML(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreeLang v11</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .hero {
      text-align: center;
      color: white;
      max-width: 800px;
    }
    h1 { font-size: 3em; margin-bottom: 10px; }
    p { font-size: 1.2em; margin-bottom: 30px; opacity: 0.9; }
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin: 40px 0;
    }
    .feature {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      padding: 20px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .feature h3 { margin-bottom: 10px; }
    .links {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
      margin-top: 30px;
    }
    a {
      background: white;
      color: #667eea;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: bold;
      transition: all 0.2s;
    }
    a:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div class="hero">
    <h1>FreeLang v11</h1>
    <p>AI-Native Language with App Router</p>

    <div class="features">
      <div class="feature">
        <h3>Pure v11</h3>
        <p>100% FreeLang v11</p>
      </div>
      <div class="feature">
        <h3>Zero Deps</h3>
        <p>No npm dependencies</p>
      </div>
      <div class="feature">
        <h3>App Router</h3>
        <p>Filesystem-based routing</p>
      </div>
      <div class="feature">
        <h3>AGENT</h3>
        <p>Native AI blocks</p>
      </div>
    </div>

    <div class="links">
      <a href="/demo">Demo</a>
      <a href="/api/status">Status API</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * v11 웹 서버
 */
export class WebServer {
  private router: AppRouter;
  private executor: FLExecutor | null = null;
  private renderer: PageRenderer | null = null;
  private server: http.Server | null = null;
  private config: Required<ServerConfig>;

  constructor(config: ServerConfig = {}) {
    this.config = {
      appDir: config.appDir || "app",
      port: config.port || 3000,
      renderMode: config.renderMode || "ssr",
    };

    this.router = new AppRouter(this.config.appDir);
  }

  /**
   * 인터프리터 설정 (외부에서 주입)
   */
  setInterpreter(interpreter: Interpreter): void {
    this.executor = new FLExecutor(interpreter);
    this.renderer = new PageRenderer(this.executor);
  }

  /**
   * 서버 시작
   */
  async start(): Promise<string> {
    this.server = http.createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, () => {
        const port = this.config.port;
        const routes = this.router.getRoutes();
        const msg = `server.listening port=${port}`;
        console.log(`server.start port=${port} app_routes=${routes.length}`);
        for (const route of routes) {
          console.log(`server.route path=${route.path} file=${route.filePath}`);
        }
        resolve(msg);
      });
    });
  }

  /**
   * 서버 중지
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  /**
   * HTTP 요청 처리
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    // URL 파싱
    const urlPath = (req.url || "/").split("?")[0];
    const query = this.parseQuery(req.url || "/");

    // JSON body 파싱
    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        const bodyStr = Buffer.concat(chunks).toString("utf-8");
        if (bodyStr && req.headers["content-type"]?.includes("application/json")) {
          body = JSON.parse(bodyStr);
        }
      } catch (e) {
        // JSON 파싱 실패 시 빈 객체
      }
    }

    // CORS 헤더
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // App Router로 라우트 매칭 (먼저 시도)
    const match = this.router.match(urlPath);

    // App Router 매칭 성공 → .fl 파일 렌더링
    if (match) {
      // executor가 설정되어 있으면 .fl 파일 실행
      if (this.executor) {
        try {
          const routeKind = (match.route as any).kind || "page";
          // route.fl 이면 항상 JSON API 모드, 그 외엔 /api/ 접두사 규칙 유지
          const isApiPath = routeKind === "route" || urlPath.startsWith("/api/");

          const executorContext = {
            req: { method: req.method, path: urlPath, headers: req.headers as Record<string, string> },
            params: match.params,
            query,
            body,
            method: req.method,
            isApiPath,
          };

          const result = routeKind === "route"
            ? await this.executor.executeRoute(match.route.filePath, executorContext)
            : await this.executor.executePage(match.route.filePath, executorContext);

          // JSON API 모드: 응답을 JSON으로 처리
          if (isApiPath) {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(result.status || 200);

            // result.body가 객체면 JSON 직렬화, 문자열이면 그대로 반환
            if (typeof result.body === "string") {
              res.end(result.body);
            } else if (result.body !== null && typeof result.body === "object") {
              res.end(JSON.stringify(result.body));
            } else {
              res.end(JSON.stringify({ success: result.success, body: result.body }));
            }
            return;
          }

          // HTML 모드: 기존 처리
          if (result.success && typeof result.body === "string") {
            let finalBody = result.body;
            // Apply layout chain if any (match.route.layouts from app-router)
            const layouts = (match.route as any).layouts as string[] | undefined;
            if (this.renderer && layouts && layouts.length > 0) {
              try {
                finalBody = await this.renderer.renderWithLayout(finalBody, layouts);
              } catch { /* fall back to raw body */ }
            }

            // W1: 동적 메타데이터 주입
            if (result.meta && Object.keys(result.meta).length > 0) {
              finalBody = this.injectMetaIntoHead(finalBody, result.meta);
            }

            res.setHeader("Content-Type", result.contentType || "text/html; charset=utf-8");
            res.writeHead(result.status || 200);
            res.end(finalBody);
          } else {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.writeHead(result.status || 500);
            res.end(result.error || "Internal Server Error");
          }
          return;
        } catch (err: any) {
          const isApiPath = urlPath.startsWith("/api/");
          if (isApiPath) {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(500);
            res.end(JSON.stringify({ error: err.message }));
          } else {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.writeHead(500);
            res.end(generateHTML("Error", `<h1>Error</h1><p>${err.message}</p>`));
          }
          return;
        }
      }

      // executor가 없으면 기본 HTML 생성 (fallback)
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(generatePageHTML(match.route, match.params));
      return;
    }

    // 레거시 데모 라우트 (App Router 매칭 실패 후)
    if (urlPath === "/demo") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(generateHTML("Demo", "<h1>Demo Page</h1><p>App Router demo</p>"));
      return;
    }

    if (urlPath === "/api/status") {
      res.setHeader("Content-Type", "application/json");
      res.writeHead(200);
      res.end(
        JSON.stringify({
          status: "ok",
          framework: "FreeLang v11",
          router: "App Router v1.0",
          routes: this.router.getRoutes().length,
          message: "Pure v11 web framework with filesystem routing",
        })
      );
      return;
    }

    // 기본 홈페이지 (App Router에 정의되지 않은 경우)
    if (urlPath === "/" || urlPath === "") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(generateIndexHTML());
      return;
    }

    // 404
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(404);
    res.end(
      generateHTML(
        "404",
        `<h1>404 Not Found</h1><p>Route not found: ${escHtml(urlPath)}</p>`
      )
    );
  }

  /**
   * W1: HTML <head>에 메타데이터 주입
   */
  private injectMetaIntoHead(html: string, meta: Record<string, string>): string {
    // <head> 태그 찾기
    const headMatch = html.match(/<head[^>]*>/i);
    if (!headMatch) return html; // <head> 없으면 그대로 반환

    const headTag = headMatch[0];
    const headIndex = html.indexOf(headTag);
    const headEndIndex = headIndex + headTag.length;

    // 메타 태그 생성 (기존 메타와 중복 방지)
    const existingMeta = html.substring(headIndex, html.indexOf("</head>", headIndex));
    const metaTags: string[] = [];

    // title 태그
    if (meta.title && !existingMeta.includes("<title>")) {
      metaTags.push(`<title>${escHtml(meta.title)}</title>`);
    }

    // description 메타
    if (meta.description && !existingMeta.includes('name="description"')) {
      metaTags.push(`<meta name="description" content="${escHtml(meta.description)}">`);
    }

    // og:image
    if (meta["og-image"] && !existingMeta.includes('property="og:image"')) {
      metaTags.push(`<meta property="og:image" content="${escHtml(meta["og-image"])}">`);
    }

    // og:url
    if (meta["og-url"] && !existingMeta.includes('property="og:url"')) {
      metaTags.push(`<meta property="og:url" content="${escHtml(meta["og-url"])}">`);
    }

    // canonical
    if (meta.canonical && !existingMeta.includes('rel="canonical"')) {
      metaTags.push(`<link rel="canonical" href="${escHtml(meta.canonical)}">`);
    }

    // 추가 메타 태그들
    if (meta["og-title"] && !existingMeta.includes('property="og:title"')) {
      metaTags.push(`<meta property="og:title" content="${escHtml(meta["og-title"])}">`);
    }

    if (meta["og-description"] && !existingMeta.includes('property="og:description"')) {
      metaTags.push(`<meta property="og:description" content="${escHtml(meta["og-description"])}">`);
    }

    // 메타 태그 주입
    const metaString = metaTags.join("\n  ");
    return (
      html.substring(0, headEndIndex) +
      "\n  " +
      metaString +
      html.substring(headEndIndex)
    );
  }

  /**
   * URL 쿼리 파싱
   */
  private parseQuery(url: string): Record<string, string> {
    const queryStr = url.split("?")[1];
    if (!queryStr) return {};

    const query: Record<string, string> = {};
    for (const pair of queryStr.split("&")) {
      const [key, value] = pair.split("=");
      if (key) {
        query[decodeURIComponent(key)] = decodeURIComponent(value || "");
      }
    }
    return query;
  }

  /**
   * 라우터 조회
   */
  getRouter(): AppRouter {
    return this.router;
  }

  /**
   * 렌더러 조회
   */
  getRenderer(): PageRenderer | null {
    return this.renderer;
  }

  /**
   * 실행기 조회
   */
  getExecutor(): FLExecutor | null {
    return this.executor;
  }
}

export default WebServer;
