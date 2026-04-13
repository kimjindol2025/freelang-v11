// FreeLang v9: 미들웨어 체인 모듈
// Phase 9: Express-style middleware chain (v9 네이티브)

interface MiddlewareHandler {
  name: string;
  condition?: (req: any) => boolean;
  handler: (req: any) => any;
  onFail?: (req: any) => any;
}

export function createMiddlewareModule() {
  const middlewares = new Map<string, MiddlewareHandler>();
  const chains: string[][] = [];

  return {
    // middleware_define(name, condition, handler, onFail) → middleware
    "middleware_define": (name: string, condition: any, handler: any, onFail?: any): any => {
      try {
        const mw: MiddlewareHandler = {
          name,
          condition: typeof condition === "function" ? condition : undefined,
          handler: typeof handler === "function" ? handler : () => handler,
          onFail: typeof onFail === "function" ? onFail : undefined
        };

        middlewares.set(name, mw);

        return {
          name,
          defined: true,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err: any) {
        throw new Error(`middleware_define failed: ${err.message}`);
      }
    },

    // middleware_create_chain(middlewares[]) → chain
    "middleware_create_chain": (names: string[]): string[] => {
      try {
        const chain = names.filter(name => middlewares.has(name));
        chains.push(chain);
        return chain;
      } catch (err: any) {
        throw new Error(`middleware_create_chain failed: ${err.message}`);
      }
    },

    // middleware_apply_chain(chainId, request) → {passed: boolean, result: any, errors: []}
    "middleware_apply_chain": (chainId: number, request: any): any => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }

        const errors: string[] = [];
        let currentRequest = request;
        let passed = true;

        for (const middlewareName of chain) {
          const mw = middlewares.get(middlewareName);
          if (!mw) continue;

          // 조건 체크
          if (mw.condition && !mw.condition(currentRequest)) {
            if (mw.onFail) {
              const result = mw.onFail(currentRequest);
              if (result && typeof result === "object" && "error" in result) {
                errors.push(`${middlewareName}: condition failed`);
                passed = false;
                break;
              }
            } else {
              errors.push(`${middlewareName}: condition not met`);
              passed = false;
              break;
            }
          } else {
            // 핸들러 실행
            try {
              currentRequest = mw.handler(currentRequest);
            } catch (err: any) {
              errors.push(`${middlewareName}: ${err.message}`);
              passed = false;
              if (mw.onFail) {
                mw.onFail(currentRequest);
              }
              break;
            }
          }
        }

        return {
          passed,
          request: currentRequest,
          errors,
          chainLength: chain.length,
          executedMiddlewares: chain.length - (errors.length > 0 ? 1 : 0)
        };
      } catch (err: any) {
        throw new Error(`middleware_apply_chain failed: ${err.message}`);
      }
    },

    // middleware_add_to_chain(chainId, middleware) → chain
    "middleware_add_to_chain": (chainId: number, middlewareName: string): string[] => {
      try {
        const chain = chains[chainId];
        if (!chain) {
          throw new Error(`Chain not found: ${chainId}`);
        }

        if (middlewares.has(middlewareName)) {
          chain.push(middlewareName);
        }

        return chain;
      } catch (err: any) {
        throw new Error(`middleware_add_to_chain failed: ${err.message}`);
      }
    },

    // middleware_get(name) → middleware
    "middleware_get": (name: string): any => {
      try {
        const mw = middlewares.get(name);
        if (!mw) {
          return null;
        }

        return {
          name: mw.name,
          hasCondition: !!mw.condition,
          hasOnFail: !!mw.onFail
        };
      } catch (err: any) {
        throw new Error(`middleware_get failed: ${err.message}`);
      }
    },

    // 내장 미들웨어: 인증 체크
    "middleware_auth_check": (token?: any): MiddlewareHandler => {
      return {
        name: "auth-check",
        condition: (req: any) => {
          const authHeader = req.headers?.authorization || req.auth;
          return !!authHeader && authHeader.startsWith("Bearer ");
        },
        handler: (req: any) => {
          const authHeader = req.headers?.authorization || req.auth;
          const token = authHeader.replace("Bearer ", "");
          return { ...req, user: { token } };
        },
        onFail: (req: any) => ({ error: "UNAUTHORIZED", statusCode: 401 })
      };
    },

    // 내장 미들웨어: 요청 로깅
    "middleware_logging": (): MiddlewareHandler => {
      return {
        name: "logging",
        handler: (req: any) => {
          const timestamp = new Date().toISOString();
          console.log(`[${timestamp}] ${req.method || "GET"} ${req.path || "/"}`);
          return req;
        }
      };
    },

    // 내장 미들웨어: 요청 제한 (Rate limiting)
    "middleware_rate_limit": (limit: number = 100, windowMs: number = 60000): MiddlewareHandler => {
      const requestCounts = new Map<string, number[]>();

      return {
        name: "rate-limit",
        handler: (req: any) => {
          const clientId = req.ip || req.headers?.["x-forwarded-for"] || "unknown";
          const now = Date.now();
          const windowStart = now - windowMs;

          if (!requestCounts.has(clientId)) {
            requestCounts.set(clientId, []);
          }

          const requests = requestCounts.get(clientId)!;
          const recentRequests = requests.filter(t => t > windowStart);

          if (recentRequests.length >= limit) {
            throw new Error(`Rate limit exceeded: ${limit} requests per ${windowMs}ms`);
          }

          recentRequests.push(now);
          requestCounts.set(clientId, recentRequests);

          return { ...req, rateLimit: { remaining: limit - recentRequests.length } };
        },
        onFail: (req: any) => ({ error: "TOO_MANY_REQUESTS", statusCode: 429 })
      };
    },

    // 내장 미들웨어: CORS
    "middleware_cors": (allowOrigin?: string): MiddlewareHandler => {
      return {
        name: "cors",
        handler: (req: any) => {
          return {
            ...req,
            headers: {
              ...req.headers,
              "Access-Control-Allow-Origin": allowOrigin || "*",
              "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type,Authorization"
            }
          };
        }
      };
    }
  };
}
