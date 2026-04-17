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
  body?: Record<string, any> | string;
  method?: string;
  isApiPath?: boolean;
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
  private _helpersInjected: boolean = false;

  constructor(interpreter: Interpreter) {
    this.interpreter = interpreter;
  }

  /**
   * JWT/Auth/DB 헬퍼 주입 (1회만 실행)
   */
  private ensureHelpers(): void {
    if (this._helpersInjected) return;
    this.injectJWTFunctions();
    this.injectAuthHelpers();
    this.injectDBHelpers();
    this._helpersInjected = true;
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
   * 인메모리 데이터 스토어 초기화
   */
  private initializeDataStore(): void {
    const ctx = this.interpreter.context as any;
    if (!ctx.__db) {
      ctx.__db = {
        users: new Map(),
        projects: new Map(),
        todos: new Map(),
        sessions: new Map(),
        messages: new Map(),
        boards: new Map(),
        documents: [],
        boardMembers: new Map(),
        _nextId: { users: 1, projects: 1, todos: 1, messages: 1, boards: 1 },
      };
    }
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

      // 인메모리 데이터 스토어 초기화
      this.initializeDataStore();

      const ctx = this.interpreter.context as any;
      const db = ctx.__db;

      // params를 interpreter context에 주입 (템플릿 보간용)
      ctx.__params = context.params || {};
      ctx.__body = context.body || {};
      ctx.__method = context.method || "GET";
      ctx.__headers = context.headers || {};
      ctx.__query = context.query || {};

      // DB 컬렉션을 직접 주입
      ctx.__db_users = db.users;
      ctx.__db_projects = db.projects;
      ctx.__db_todos = db.todos;
      ctx.__db_sessions = db.sessions;
      ctx.__db_messages = db.messages;
      ctx.__db_boards = db.boards;
      ctx.__db_members = db.boardMembers;

      // JWT/Auth/DB 헬퍼 주입 (1회만)
      this.ensureHelpers();

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

      // JWT/Auth/DB 헬퍼 주입 (1회만)
      this.ensureHelpers();

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

  /**
   * JWT 함수 주입 (간단한 구현)
   */
  private injectJWTFunctions(): void {
    const ctx = this.interpreter.context as any;

    // JWT Sign (매우 간단한 구현 - production에서는 jsonwebtoken 라이브러리 사용)
    ctx["jwt-sign"] = (payload: any, secret: string = "default-secret"): string => {
      const header = { alg: "HS256", typ: "JWT" };
      const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = Buffer.from(
        `${encodedHeader}.${encodedPayload}${secret}`
      )
        .toString("base64url")
        .substring(0, 20);
      return `${encodedHeader}.${encodedPayload}.${signature}`;
    };

    // JWT Verify
    ctx["jwt-verify"] = (token: string, secret: string = "default-secret"): any => {
      try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(
          Buffer.from(parts[1], "base64url").toString()
        );
        return payload;
      } catch (e) {
        return null;
      }
    };
  }

  /**
   * 인증 헬퍼 함수 주입
   */
  private injectAuthHelpers(): void {
    const ctx = this.interpreter.context as any;

    // JWT로부터 사용자 정보 추출
    ctx["auth-user"] = (authHeader: string): any => {
      if (!authHeader) return null;
      const token = authHeader.replace("Bearer ", "");
      const payload = ctx["jwt-verify"](token);
      if (!payload) return null;

      // DB에서 사용자 조회
      const db = ctx.__db;
      if (db && db.users) {
        const user = Array.from(db.users.values()).find(
          (u: any) => u.id === payload.userId
        );
        return user || null;
      }
      return payload;
    };
  }

  /**
   * DB 헬퍼 함수 주입
   */
  private injectDBHelpers(): void {
    const ctx = this.interpreter.context as any;

    // 데이터 생성
    ctx["create"] = (collection: Map<any, any>, data: any): any => {
      const db = ctx.__db;
      const tableName = Object.keys(db).find(
        (key) => db[key] === collection
      );
      let id = db._nextId[tableName] || 1;
      db._nextId[tableName] = id + 1;
      const item = { id, ...data, created_at: new Date() };
      collection.set(id, item);
      return item;
    };

    // 데이터 조회
    ctx["get"] = (collection: Map<any, any>, id: any): any => {
      return collection.get(id);
    };

    // 데이터 목록
    ctx["list"] = (collection: Map<any, any>): any[] => {
      return Array.from(collection.values());
    };

    // 데이터 업데이트
    ctx["update"] = (collection: Map<any, any>, id: any, data: any): any => {
      const item = collection.get(id);
      if (item) {
        const updated = { ...item, ...data, updated_at: new Date() };
        collection.set(id, updated);
        return updated;
      }
      return null;
    };

    // 데이터 삭제
    ctx["delete"] = (collection: Map<any, any>, id: any): boolean => {
      return collection.delete(id);
    };

    // 멤버 조회
    ctx["get-member"] = (
      memberCollection: Map<any, any>,
      boardId: any,
      userId: any
    ): any => {
      const key = `${boardId}:${userId}`;
      return memberCollection.get(key);
    };

    // 멤버 추가
    ctx["add-member"] = (
      memberCollection: Map<any, any>,
      boardId: any,
      userId: any,
      role: string = "member"
    ): any => {
      const key = `${boardId}:${userId}`;
      const member = { boardId, userId, role, joined_at: new Date() };
      memberCollection.set(key, member);
      return member;
    };

    // 문자열을 정수로 변환
    ctx["str-to-int"] = (str: any): number => {
      return parseInt(String(str), 10);
    };

    // 두 객체 병합
    ctx["merge"] = (obj1: any, obj2: any): any => {
      return { ...obj1, ...obj2 };
    };

    // 객체 개수
    ctx["count"] = (obj: any): number => {
      if (obj instanceof Map) return obj.size;
      if (Array.isArray(obj)) return obj.length;
      if (typeof obj === "object" && obj !== null) return Object.keys(obj).length;
      return 0;
    };
  }
}

export default FLExecutor;
