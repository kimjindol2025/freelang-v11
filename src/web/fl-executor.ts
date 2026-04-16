/**
 * FreeLang v11 - FL Executor (page.fl Runtime Bridge)
 * .fl 파일 실행 및 결과 처리
 */

import * as fs from "fs";
import * as path from "path";
import { Interpreter } from "../interpreter";
import { lex } from "../lexer";
import { parse } from "../parser";
import { ASTNode } from "../ast";

export interface ExecutorContext {
  req?: Record<string, any>;
  params?: Record<string, string>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: string;
}

export interface ExecutionResult {
  success: boolean;
  body?: string | Record<string, any>;
  contentType?: string;
  status?: number;
  error?: string;
  stack?: string;
}

/**
 * FL 파일 실행 브릿지
 * page.fl을 읽고 Interpreter로 실행
 */
export class FLExecutor {
  private interpreter: Interpreter;
  private cache: Map<string, { ast: ASTNode[]; timestamp: number }> = new Map();
  private cacheTimeout: number = 5 * 60 * 1000; // 5분

  constructor(interpreter: Interpreter) {
    this.interpreter = interpreter;
  }

  /**
   * .fl 파일 읽기 및 파싱 (캐싱 적용)
   */
  private parseFile(filePath: string): ASTNode[] {
    const now = Date.now();
    const cached = this.cache.get(filePath);

    // 캐시 유효성 확인
    if (cached && now - cached.timestamp < this.cacheTimeout) {
      return cached.ast;
    }

    // 파일 읽기
    const code = fs.readFileSync(filePath, "utf-8");

    // 렉싱 및 파싱
    const tokens = lex(code);
    const ast = parse(tokens);

    // 캐시 저장
    this.cache.set(filePath, { ast, timestamp: now });

    return ast;
  }

  /**
   * 페이지 컴포넌트 실행
   * 반환 값: { html, json, statusCode 등 }
   */
  async executePage(
    filePath: string,
    context: ExecutorContext
  ): Promise<ExecutionResult> {
    try {
      // 파일 존재 확인
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          status: 404,
          error: `Page not found: ${filePath}`,
        };
      }

      // AST 파싱
      const astList = this.parseFile(filePath);

      // 컨텍스트를 v9 요청 객체로 변환
      const flRequest = this.createFlRequest(context);

      // params를 interpreter context에 주입 (템플릿 보간용)
      (this.interpreter.context as any).__params = context.params || {};

      // 인터프리터 실행 (interpreter.interpret()로 PAGE/COMPONENT/FORM 블록 처리)
      const execContext = this.interpreter.interpret(astList);

      // lastValue가 결과
      const result = execContext.lastValue;

      // 반환 값 분석
      return this.processResult(result);
    } catch (err: any) {
      return {
        success: false,
        status: 500,
        error: err.message,
        stack: err.stack,
      };
    }
  }

  /**
   * API 라우트 실행 (route.fl)
   */
  async executeRoute(
    filePath: string,
    context: ExecutorContext
  ): Promise<ExecutionResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          status: 404,
          error: `Route not found: ${filePath}`,
        };
      }

      const astList = this.parseFile(filePath);
      const flRequest = this.createFlRequest(context);

      // 함수 호출 (route 파일은 보통 handler 함수를 export)
      (this.interpreter as any).globals = (this.interpreter as any).globals || {};
      (this.interpreter as any).globals.__request = flRequest;
      (this.interpreter as any).globals.__params = context.params || {};

      let result: any = null;
      for (const ast of astList) {
        result = this.interpreter.eval(ast);
      }

      return this.processResult(result);
    } catch (err: any) {
      return {
        success: false,
        status: 500,
        error: err.message,
        stack: err.stack,
      };
    }
  }

  /**
   * 실행 컨텍스트를 v9 요청 객체로 변환
   */
  private createFlRequest(context: ExecutorContext): Record<string, any> {
    return {
      __fl_request: true,
      method: context.req?.method || "GET",
      path: context.req?.path || "/",
      query: context.query || {},
      params: context.params || {},
      headers: context.headers || {},
      body: context.body || "",
      timestamp: Date.now(),
    };
  }

  /**
   * 인터프리터 결과를 HTTP 응답으로 변환
   */
  private processResult(result: any): ExecutionResult {
    // v9 응답 객체
    if (result && typeof result === "object") {
      if (result.__fl_response === true) {
        return {
          success: true,
          status: result.status || 200,
          body: result.body,
          contentType: result.contentType || "application/json",
        };
      }

      // 일반 객체 → JSON
      return {
        success: true,
        status: 200,
        body: result,
        contentType: "application/json",
      };
    }

    // 문자열 → HTML
    if (typeof result === "string") {
      return {
        success: true,
        status: 200,
        body: result,
        contentType: result.includes("<")
          ? "text/html; charset=utf-8"
          : "text/plain",
      };
    }

    // null / undefined
    return {
      success: true,
      status: 204,
      body: "",
      contentType: "text/plain",
    };
  }

  /**
   * 캐시 비우기
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }

  /**
   * 캐시 상태 조회
   */
  getCacheStats(): { size: number; files: string[] } {
    return {
      size: this.cache.size,
      files: Array.from(this.cache.keys()),
    };
  }
}

export default FLExecutor;
