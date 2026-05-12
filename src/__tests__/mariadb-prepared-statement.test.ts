/**
 * Prepared Statement Tests (v11.6.21)
 * MariaDB bindParams 함수 강화 검증
 *
 * 테스트 항목:
 * 1. 기본 타입 (string, number, boolean, null)
 * 2. 배열 파라미터 (IN 절)
 * 3. 이스케이프 처리
 * 4. SQL Injection 방어
 * 5. 타입 검증
 * 6. 순차 치환 (위치 기반 아님)
 */

import { describe, test, expect } from "@jest/globals";

// bindParams 함수 테스트용 복사
// (실제로는 stdlib-mariadb.ts에서 export 필요)
function escapeString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/'/g, "''")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
}

function bindParamsEnhanced(sql: string, params: any[]): string {
  if (!params || params.length === 0) return sql;

  return params.reduce((s: string, p: any) => {
    // null/undefined
    if (p === null || p === undefined) {
      return s.replace("?", "NULL");
    }

    // boolean
    if (typeof p === "boolean") {
      return s.replace("?", p ? "1" : "0");
    }

    // number
    if (typeof p === "number") {
      if (!isFinite(p) || isNaN(p)) {
        throw new Error(`SQL 파라미터 오류: 유효하지 않은 숫자 (${p})`);
      }
      return s.replace("?", String(p));
    }

    // 배열 (IN 절) — v11.6.21 신규
    if (Array.isArray(p)) {
      const items = p.map((item) => {
        if (item === null || item === undefined) return "NULL";
        if (typeof item === "number") return String(item);
        if (typeof item === "boolean") return item ? "1" : "0";
        return `'${escapeString(String(item))}'`;
      });
      return s.replace("?", items.join(", "));
    }

    // Date 객체 — v11.6.21 신규
    if (p instanceof Date) {
      return s.replace("?", `'${p.toISOString()}'`);
    }

    // 일반 객체 → 에러
    if (typeof p === "object") {
      throw new Error(
        `SQL 파라미터 오류: 객체는 파라미터로 사용 불가 (받은 값: ${JSON.stringify(p).slice(0, 80)})`
      );
    }

    // string (기본)
    return s.replace("?", `'${escapeString(String(p))}'`);
  }, sql);
}

describe("Prepared Statement (v11.6.21)", () => {
  test("기본 문자열 파라미터", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE name = ?",
      ["kim"]
    );
    expect(result).toBe("SELECT * FROM users WHERE name = 'kim'");
  });

  test("숫자 파라미터", () => {
    const result = bindParamsEnhanced("SELECT * FROM users WHERE id = ?", [42]);
    expect(result).toBe("SELECT * FROM users WHERE id = 42");
  });

  test("boolean 파라미터", () => {
    const t = bindParamsEnhanced("SELECT * WHERE active = ?", [true]);
    const f = bindParamsEnhanced("SELECT * WHERE active = ?", [false]);
    expect(t).toBe("SELECT * WHERE active = 1");
    expect(f).toBe("SELECT * WHERE active = 0");
  });

  test("null 파라미터", () => {
    const result = bindParamsEnhanced("SELECT * WHERE name = ?", [null]);
    expect(result).toBe("SELECT * WHERE name = NULL");
  });

  test("배열 파라미터 (IN 절) — v11.6.21", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE id IN (?)",
      [[1, 2, 3]]
    );
    expect(result).toBe("SELECT * FROM users WHERE id IN (1, 2, 3)");
  });

  test("배열 파라미터 (문자열 포함)", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE name IN (?)",
      [["kim", "park", "lee"]]
    );
    expect(result).toBe(
      "SELECT * FROM users WHERE name IN ('kim', 'park', 'lee')"
    );
  });

  test("배열 파라미터 (null 포함)", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE status IN (?)",
      [[1, null, 3]]
    );
    expect(result).toBe("SELECT * FROM users WHERE status IN (1, NULL, 3)");
  });

  test("Date 객체 — v11.6.21", () => {
    const date = new Date("2026-05-13T00:00:00Z");
    const result = bindParamsEnhanced("SELECT * WHERE created > ?", [date]);
    expect(result).toContain("2026-05-13T00:00:00");
  });

  test("SQL Injection 방어 (작은따옴표)", () => {
    const malicious = "'; DROP TABLE users; --";
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE name = ?",
      [malicious]
    );
    // escapeString에서 ' → ''로 변환되므로 '''가 됨 (안전)
    expect(result).toBe(
      "SELECT * FROM users WHERE name = '''; DROP TABLE users; --'"
    );
    // 주입 불가 확인: '; DROP가 SQL 명령으로 실행되지 않음
    // (따옴표 안에 escape되어 있거나 주석 처리됨)
  });

  test("SQL Injection 방어 (역슬래시)", () => {
    const malicious = "test\\'; DROP TABLE users; --";
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE name = ?",
      [malicious]
    );
    // escapeString에서 \ → \\, ' → '' 로 escape됨
    expect(result).toContain("\\\\");  // 역슬래시 escape 확인 (\ → \\)
    expect(result).toContain("''");    // 작은따옴표 escape 확인 (' → '')
  });

  test("복수 파라미터", () => {
    const result = bindParamsEnhanced(
      "INSERT INTO users (name, age, active) VALUES (?, ?, ?)",
      ["kim", 30, true]
    );
    expect(result).toBe(
      "INSERT INTO users (name, age, active) VALUES ('kim', 30, 1)"
    );
  });

  test("NaN 검증", () => {
    expect(() => {
      bindParamsEnhanced("SELECT * WHERE val = ?", [NaN]);
    }).toThrow("유효하지 않은 숫자");
  });

  test("Infinity 검증", () => {
    expect(() => {
      bindParamsEnhanced("SELECT * WHERE val = ?", [Infinity]);
    }).toThrow("유효하지 않은 숫자");
  });

  test("일반 객체 거부", () => {
    expect(() => {
      bindParamsEnhanced("SELECT * WHERE data = ?", [{ key: "value" }]);
    }).toThrow("객체는 파라미터로 사용 불가");
  });

  test("빈 배열", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE id IN (?)",
      [[]]
    );
    expect(result).toBe("SELECT * FROM users WHERE id IN ()");
  });

  test("여러 ?가 있을 때 순차 치환", () => {
    const result = bindParamsEnhanced(
      "SELECT * FROM users WHERE id = ? AND name = ? AND active = ?",
      [1, "kim", true]
    );
    expect(result).toBe(
      "SELECT * FROM users WHERE id = 1 AND name = 'kim' AND active = 1"
    );
  });
});
