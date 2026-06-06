/**
 * Rate Limiter Tests (v11.6.20)
 * HTTP 미들웨어 레벨 Rate Limiter 검증
 *
 * 테스트 항목:
 * 1. IP 기반 슬라이딩 윈도우
 * 2. 429 Too Many Requests 응답
 * 3. Retry-After 헤더
 * 4. server_rate_limit 설정 함수
 * 5. 시간 윈도우 초과 시 카운터 리셋
 * 6. 다중 IP 독립 추적
 */

import { describe, test, expect, beforeEach, afterEach } from "@jest/globals";
import * as http from "http";
import { createHttpServerModule } from "../stdlib-http-server";

describe("Rate Limiter (v11.6.20)", () => {
  let server: string | undefined;
  let serverModule: ReturnType<typeof createHttpServerModule>;
  const port = 9876;

  const mockCallFn = (name: string, args: any[]): any => {
    if (name === "test-handler") {
      return { status: 200, body: "OK" };
    }
    return null;
  };

  const mockCallFunctionValue = (fnValue: any, args: any[]): any => {
    if (fnValue?.["__fl_function"]) {
      return { status: 200, body: "OK" };
    }
    return null;
  };

  beforeEach(() => {
    serverModule = createHttpServerModule(mockCallFn, mockCallFunctionValue);
    server = undefined;
  });

  afterEach(() => {
    if (server) {
      serverModule.server_stop();
      server = undefined;
    }
  });

  test("기본 요청은 성공 (IP 초기 요청)", (done) => {

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port);

    const req = http.get(`http://localhost:${port}/`, (res) => {
      expect(res.statusCode).toBe(200);
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        expect(data).toContain("OK");
        done();
      });
    });

    req.on("error", () => done());
  });

  test("server_rate_limit 함수 호출 성공", () => {
    const result = (serverModule.server_rate_limit as any)(10, 1000);
    expect(result).toBeNull(); // server_rate_limit은 null 반환
  });

  test("요청 제한 초과 시 429 응답", (done) => {

    // Rate limit: 2 요청 / 1초
    (serverModule.server_rate_limit as any)(2, 1000);

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port + 1);

    let successCount = 0;
    let rateLimitedCount = 0;

    const makeRequest = (index: number) => {
      if (index > 5) {
        // 6개 요청 시도 (2개만 통과 가능)
        expect(successCount).toBe(2);
        expect(rateLimitedCount).toBe(4); // 3번째부터는 429
        done();
        return;
      }

      const req = http.get(`http://localhost:${port + 1}/`, (res) => {
        if (res.statusCode === 200) {
          successCount++;
        } else if (res.statusCode === 429) {
          rateLimitedCount++;
          expect(res.headers["retry-after"]).toBeDefined();
        }
        res.on("data", () => {});
        res.on("end", () => {
          makeRequest(index + 1);
        });
      });

      req.on("error", () => {});
    };

    makeRequest(0);
  });

  test("Retry-After 헤더 포함", (done) => {

    // Rate limit: 1 요청 / 1초
    (serverModule.server_rate_limit as any)(1, 1000);

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port + 2);

    // 첫 번째 요청 (성공)
    const req1 = http.get(`http://localhost:${port + 2}/`, (res1) => {
      res1.on("data", () => {});
      res1.on("end", () => {
        // 두 번째 요청 (Rate limited)
        const req2 = http.get(`http://localhost:${port + 2}/`, (res2) => {
          expect(res2.statusCode).toBe(429);
          expect(res2.headers["retry-after"]).toBeDefined();

          const retryAfter = parseInt(
            res2.headers["retry-after"] as string,
            10
          );
          expect(retryAfter).toBeGreaterThan(0);
          expect(retryAfter).toBeLessThanOrEqual(2); // 윈도우는 1초 = 최대 2초

          res2.on("data", () => {});
          res2.on("end", () => done());
        });
        req2.on("error", () => done());
      });
    });

    req1.on("error", () => done());
  });

  test("다중 IP는 독립적으로 추적", (done) => {
    // X-Forwarded-For 신뢰는 FL_TRUST_PROXY=1 필요 (stdlib-http-server.ts:500)
    const prevTrustProxy = process.env.FL_TRUST_PROXY;
    process.env.FL_TRUST_PROXY = "1";
    const restoreTrustProxy = () => {
      if (prevTrustProxy === undefined) delete process.env.FL_TRUST_PROXY;
      else process.env.FL_TRUST_PROXY = prevTrustProxy;
    };

    // Rate limit: 2 요청 / 1초
    (serverModule.server_rate_limit as any)(2, 1000);

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port + 3);

    // IP1: 3 요청 시도 (2 성공 + 1 Rate limited)
    // IP2: 2 요청 시도 (2 성공)
    // 각 IP는 독립적으로 카운팅

    const makeRequests = (ipHeader: string, expectedResults: number[]) => {
      let results: number[] = [];

      const makeOneRequest = (index: number) => {
        if (index >= expectedResults.length) {
          return Promise.resolve(results);
        }

        return new Promise<number[]>((resolve) => {
          const req = http.get(
            {
              hostname: "localhost",
              port: port + 3,
              path: "/",
              headers: { "x-forwarded-for": ipHeader },
            },
            (res) => {
              results.push(res.statusCode || 500);
              res.on("data", () => {});
              res.on("end", () => {
                makeOneRequest(index + 1).then(resolve);
              });
            }
          );
          req.on("error", () => resolve(results));
        });
      };

      return makeOneRequest(0);
    };

    Promise.all([
      makeRequests("192.168.1.1", [0, 0, 0]), // 3 요청
      makeRequests("192.168.1.2", [0, 0]), // 2 요청
    ]).then(([ip1Results, ip2Results]) => {
      // IP1: 200, 200, 429
      expect(ip1Results[0]).toBe(200);
      expect(ip1Results[1]).toBe(200);
      expect(ip1Results[2]).toBe(429);

      // IP2: 200, 200 (독립적으로 카운팅)
      expect(ip2Results[0]).toBe(200);
      expect(ip2Results[1]).toBe(200);

      restoreTrustProxy();
      done();
    });
  });

  test("시간 윈도우 초과 후 카운터 리셋", (done) => {

    // Rate limit: 1 요청 / 1000ms (server_rate_limit은 최소 1초로 클램프)
    (serverModule.server_rate_limit as any)(1, 1000);

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port + 4);

    const makeRequest = () => {
      return new Promise<number>((resolve) => {
        const req = http.get(`http://localhost:${port + 4}/`, (res) => {
          res.on("data", () => {});
          res.on("end", () => resolve(res.statusCode || 500));
        });
        req.on("error", () => resolve(500));
      });
    };

    (async () => {
      // 첫 번째 요청 (성공)
      const status1 = await makeRequest();
      expect(status1).toBe(200);

      // 즉시 두 번째 요청 (Rate limited)
      const status2 = await makeRequest();
      expect(status2).toBe(429);

      // 윈도우 초과 후 세 번째 요청 (성공)
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const status3 = await makeRequest();
      expect(status3).toBe(200);

      done();
    })();
  }, 15000);

  test("설정값 범위 검증", () => {

    // max < 1은 1로 조정
    const result1 = (serverModule.server_rate_limit as any)(0, 1000);
    expect(result1).toBeNull();

    // windowMs < 1000은 1000으로 조정
    const result2 = (serverModule.server_rate_limit as any)(10, 500);
    expect(result2).toBeNull();

    (serverModule.server_get as any)("/", "test-handler");
    server = (serverModule.server_start as any)(port + 5);

    // 설정이 적용됨 (에러 없음)
    expect(server).toBeDefined();
  });
});
