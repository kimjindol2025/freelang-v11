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
function generateHTML(title: string, content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FreeLang v11 - ${title}</title>
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
    a:hover { text-decoration: underline; }
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
    <h1>🚀 FreeLang v11</h1>
    <p>AI-Native Language with App Router</p>

    <div class="features">
      <div class="feature">
        <h3>💎 Pure v11</h3>
        <p>100% FreeLang v11</p>
      </div>
      <div class="feature">
        <h3>⚡ Zero Deps</h3>
        <p>No npm dependencies</p>
      </div>
      <div class="feature">
        <h3>🎯 App Router</h3>
        <p>Filesystem-based routing</p>
      </div>
      <div class="feature">
        <h3>🤖 AGENT</h3>
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
        const msg = `🚀 FreeLang v11 Server running on port ${this.config.port}`;
        console.log("");
        console.log("╔════════════════════════════════════════════╗");
        console.log("║   🚀 FreeLang v11 Server Started          ║");
        console.log("╚════════════════════════════════════════════╝");
        console.log("");
        console.log(`📍 Server: http://localhost:${this.config.port}`);
        console.log("");
        console.log("🔗 Routes:");
        console.log(`   http://localhost:${this.config.port}          - Home`);
        console.log(`   http://localhost:${this.config.port}/demo      - Demo`);
        console.log(`   http://localhost:${this.config.port}/api/status - Status API`);
        console.log("");
        console.log("📂 App Router Routes:");
        this.router.getRoutes().forEach((route) => {
          console.log(
            `   http://localhost:${this.config.port}${route.path} - ${path.basename(
              path.dirname(route.filePath)
            )}`
          );
        });
        console.log("");
        console.log("💡 Framework: 100% Pure v11, Zero npm dependencies");
        console.log("✨ Press Ctrl+C to stop the server");
        console.log("");
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

    // App Router로 라우트 매칭
    const match = this.router.match(urlPath);

    // 레거시 데모 라우트
    if (urlPath === "/" || urlPath === "") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(generateIndexHTML());
      return;
    }

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
          message: "🚀 Pure v11 web framework with filesystem routing!",
        })
      );
      return;
    }

    // App Router 매칭
    if (match) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(generatePageHTML(match.route, match.params));
      return;
    }

    // 404
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.writeHead(404);
    res.end(
      generateHTML(
        "404",
        `<h1>404 Not Found</h1><p>Route not found: ${urlPath}</p>`
      )
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
