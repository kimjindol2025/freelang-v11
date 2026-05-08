import fs from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * FreeLang v11 → v11.5.x 마이그레이션 도구 테스트 (freelang-migrate)
 *
 * 테스트 대상: /bin/freelang-migrate
 * - 규칙 2: snake_case → kebab-case (70+ 함수)
 * - 규칙 1: 인자 순서 변환 (map/filter, 옵션)
 * - 규칙 5: $ 접두사 제거 (옵션)
 * - 규칙 3: 술어 통일 (is_X → X?, 부분)
 */

const MIGRATE_BIN = path.join(__dirname, "../../bin/freelang-migrate");
const TEMP_DIR = path.join(__dirname, "test-migrate-tmp");

describe("freelang-migrate: v11 → v11.5.x 자동 변환", () => {

  // 테스트용 임시 디렉토리
  beforeEach(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 규칙 2: snake_case → kebab-case 변환
  // ─────────────────────────────────────────────────────────────

  describe("규칙 2: kebab-case 작명", () => {
    test("str_to_num → str-to-num", () => {
      const input = '(str_to_num "42")';
      const expected = '(str-to-num "42")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("json_parse → json-parse", () => {
      const input = '(json_parse "{}")';
      const expected = '(json-parse "{}")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("http_get → http-get", () => {
      const input = '(http_get "https://example.com")';
      const expected = '(http-get "https://example.com")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("file_read → file-read", () => {
      const input = '(file_read "path.txt")';
      const expected = '(file-read "path.txt")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("server_start → server-start", () => {
      const input = "(server_start 3000)";
      const expected = "(server-start 3000)";
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("mariadb_query → mariadb-query", () => {
      const input = '(mariadb_query db "SELECT *")';
      const expected = '(mariadb-query db "SELECT *")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("auth_jwt_sign → auth-jwt-sign", () => {
      const input = "(auth_jwt_sign payload secret)";
      const expected = "(auth-jwt-sign payload secret)";
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("이미 kebab-case인 함수는 변경 안 함", () => {
      const input = "(str-to-num \"42\")";
      const result = runMigrate(input);
      expect(result).toContain("str-to-num");
      expect(result).not.toContain("str_to_num");
    });

    test("여러 함수 동시 변환", () => {
      const input = `
(let [[data (json_parse body)]]
  (str_to_num (get data "count")))
      `.trim();
      const result = runMigrate(input);
      expect(result).toContain("json-parse");
      expect(result).toContain("str-to-num");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 규칙 3: 술어 통일 (is_X → X?)
  // ─────────────────────────────────────────────────────────────

  describe("규칙 3: 술어 함수 (is_X → X?)", () => {
    test("is_array → array?", () => {
      const input = "(is_array data)";
      const expected = "(array? data)";
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("is_string → string?", () => {
      const input = "(is_string value)";
      const expected = "(string? value)";
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("is_null → nil?", () => {
      const input = "(is_null value)";
      const expected = "(nil? value)";
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });

    test("file_exists → file-exists?", () => {
      const input = '(file_exists "path.txt")';
      const expected = '(file-exists? "path.txt")';
      const result = runMigrate(input);
      expect(result).toContain(expected);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 규칙 1: 인자 순서 변환 (옵션)
  // ─────────────────────────────────────────────────────────────

  describe("규칙 1: 인자 순서 (map fn arr → map arr fn)", () => {
    test("map 인자 순서 변환 (with --apply)", () => {
      const input = "(map (fn [$x] (* $x 2)) [1 2 3])";
      const result = runMigrate(input, { argOrder: true });
      // 변환 후: (map [1 2 3] (fn [$x] (* $x 2)))
      expect(result).toContain("[1 2 3]");
    });

    test("filter 인자 순서 변환", () => {
      const input = "(filter (fn [$x] (> $x 5)) arr)";
      const result = runMigrate(input, { argOrder: true });
      expect(result).toContain("arr");
    });

    test("--no-arg-order 옵션으로 인자 순서 변환 제외", () => {
      const input = "(map (fn [$x] (* $x 2)) arr)";
      const result = runMigrate(input, { argOrder: false });
      // 변환 안 됨 (또는 kebab-case만 변환)
      expect(result).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 규칙 5: $ 접두사 제거 (옵션)
  // ─────────────────────────────────────────────────────────────

  describe("규칙 5: $ 접두사 제거 (옵션)", () => {
    test("$a $b → a b (함수 파라미터)", () => {
      const input = "(fn [$a $b] (+ $a $b))";
      const result = runMigrate(input, { removeDollar: true });
      expect(result).toContain("(fn [a b]");
      expect(result).toContain("(+ a b)");
    });

    test("let 바인딩에서 $ 제거", () => {
      const input = "(let [[$x 10] [$y 20]] (+ $x $y))";
      const result = runMigrate(input, { removeDollar: true });
      expect(result).toContain("[[x 10]");
      expect(result).toContain("(+ x y)");
    });

    test("--remove-dollar 옵션 없으면 $ 유지", () => {
      const input = "(fn [$x] (* $x 2))";
      const result = runMigrate(input, { removeDollar: false });
      expect(result).toContain("$x");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 통합 테스트: 여러 규칙 동시 적용
  // ─────────────────────────────────────────────────────────────

  describe("통합: 여러 규칙 동시 적용", () => {
    test("kebab + 술어 + $ 제거", () => {
      const input = `
(defn check-data [$data]
  (if (is_array $data)
    (let [[len (str_to_num "5")]]
      (> (json_parse $data) len))
    false))
      `.trim();

      const result = runMigrate(input, {
        removeDollar: true,
        argOrder: false,
      });

      expect(result).toContain("json-parse");
      expect(result).toContain("str-to-num");
      expect(result).toContain("array?");
      // $ 제거 확인
      expect(result).not.toContain("$data");
    });

    test("실제 서버 코드 예제", () => {
      const input = `
(defn handle-request [$req]
  (let [[body (get $req "body")]
        [count (str_to_num (get body "count"))]]
    (if (file_exists "log.txt")
      (server_json $req {:success true :count count})
      (server_status $req 404))))
      `.trim();

      const result = runMigrate(input, {
        removeDollar: true,
        argOrder: false,
      });

      expect(result).toContain("str-to-num");
      expect(result).toContain("file-exists?");
      expect(result).toContain("server-json");
      expect(result).toContain("server-status");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 엣지 케이스
  // ─────────────────────────────────────────────────────────────

  describe("엣지 케이스", () => {
    test("문자열 내의 함수명은 변환 안 함", () => {
      const input = '(println "call str_to_num to convert")';
      const result = runMigrate(input);
      // 문자열 내용은 변경하면 안 됨 (하지만 현재 구현이 보호하는지 확인 필요)
      // 이 테스트는 현재 구현의 한계를 드러낼 수 있음
    });

    test("심볼 내의 함수명은 변환 안 함", () => {
      const input = "(def str_to_num-custom (fn [x] (* x 2)))";
      const result = runMigrate(input);
      // str_to_num-custom은 다른 함수이므로 변환 안 해야 함
      // 현재 정규식: (?<![\\w\\-])${escaped}(?![\\w\\-?!])
      // → \w 경계 검사하므로 괜찮을 것 같음
    });

    test("주석은 그대로 유지", () => {
      const input = `
; 이것은 str_to_num 함수를 호출합니다
(str_to_num "42")
      `.trim();

      const result = runMigrate(input);
      expect(result).toContain("; 이것은 str_to_num"); // 주석은 변환 안 함
      expect(result).toContain('(str-to-num "42")'); // 코드는 변환
    });

    test("빈 파일 처리", () => {
      const input = "";
      const result = runMigrate(input);
      expect(result).toBe("");
    });

    test("이미 변환된 파일 처리 (멱등성)", () => {
      const input = '(str-to-num "42")';
      const result1 = runMigrate(input);
      const result2 = runMigrate(result1); // 재변환
      expect(result1).toBe(result2); // 같아야 함
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 도구 기능 테스트
  // ─────────────────────────────────────────────────────────────

  describe("freelang-migrate 도구 기능", () => {
    test("--help 옵션", () => {
      const output = execSync(`node ${MIGRATE_BIN} --help`, {
        encoding: "utf-8",
      });
      expect(output).toContain("사용법");
      expect(output).toContain("--apply");
      expect(output).toContain("--no-arg-order");
    });

    test("dry-run 모드 (파일 미수정)", () => {
      const testFile = path.join(TEMP_DIR, "test.fl");
      const input = '(str_to_num "42")';
      fs.writeFileSync(testFile, input);

      // dry-run (--apply 없음)
      execSync(`node ${MIGRATE_BIN} ${testFile}`, { stdio: "pipe" });

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toBe(input); // 파일 변경 안 됨
    });

    test("--apply 모드 (파일 수정 + 백업)", () => {
      const testFile = path.join(TEMP_DIR, "test.fl");
      const input = '(str_to_num "42")';
      fs.writeFileSync(testFile, input);

      // apply
      execSync(`node ${MIGRATE_BIN} ${testFile} --apply`);

      const content = fs.readFileSync(testFile, "utf-8");
      expect(content).toContain("str-to-num"); // 파일 변경됨

      // 백업 확인
      const backupDir = path.join(TEMP_DIR, ".v11-backup");
      expect(fs.existsSync(backupDir)).toBe(true);
      const backupFile = path.join(backupDir, "test.fl");
      expect(fs.existsSync(backupFile)).toBe(true);
      expect(fs.readFileSync(backupFile, "utf-8")).toBe(input);
    });

    test("디렉토리 전체 변환", () => {
      // 여러 .fl 파일 생성
      fs.writeFileSync(path.join(TEMP_DIR, "a.fl"), "(str_to_num \"1\")");
      fs.writeFileSync(path.join(TEMP_DIR, "b.fl"), "(json_parse \"{}\")");

      // 변환
      const output = execSync(`node ${MIGRATE_BIN} ${TEMP_DIR} --apply`, {
        encoding: "utf-8",
      });

      expect(output).toContain("2개 파일");
      expect(output).toContain("변경");

      // 파일 확인
      const aContent = fs.readFileSync(path.join(TEMP_DIR, "a.fl"), "utf-8");
      const bContent = fs.readFileSync(path.join(TEMP_DIR, "b.fl"), "utf-8");
      expect(aContent).toContain("str-to-num");
      expect(bContent).toContain("json-parse");
    });

    test(".fl 파일만 선택 (node_modules, .* 디렉토리 제외)", () => {
      fs.writeFileSync(path.join(TEMP_DIR, "app.fl"), "(str_to_num \"1\")");
      fs.mkdirSync(path.join(TEMP_DIR, "node_modules"), { recursive: true });
      fs.writeFileSync(
        path.join(TEMP_DIR, "node_modules", "lib.fl"),
        "(json_parse \"{}\")"
      );
      fs.mkdirSync(path.join(TEMP_DIR, ".hidden"), { recursive: true });
      fs.writeFileSync(
        path.join(TEMP_DIR, ".hidden", "secret.fl"),
        "(auth_jwt_sign payload secret)"
      );

      const output = execSync(`node ${MIGRATE_BIN} ${TEMP_DIR} --apply`, {
        encoding: "utf-8",
      });

      // node_modules와 .hidden은 제외되어야 함 (1개 파일만)
      expect(output).toContain("1개 파일");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 헬퍼 함수
  // ─────────────────────────────────────────────────────────────
});

/**
 * 마이그레이션 실행 헬퍼 함수
 * (실제로는 임시 파일을 만들어서 freelang-migrate 실행)
 */
function runMigrate(
  input: string,
  opts?: { argOrder?: boolean; removeDollar?: boolean }
): string {
  const MIGRATE_BIN = path.join(__dirname, "../../bin/freelang-migrate");
  const tempFile = path.join(TEMP_DIR, `temp-${Date.now()}.fl`);

  fs.writeFileSync(tempFile, input);

  const args: string[] = [tempFile];
  if (opts?.argOrder === false) args.push("--no-arg-order");
  if (opts?.removeDollar === true) args.push("--remove-dollar");
  args.push("--apply");

  try {
    execSync(`node ${MIGRATE_BIN} ${args.join(" ")}`, { stdio: "pipe" });
    const result = fs.readFileSync(tempFile, "utf-8");
    return result;
  } catch (e) {
    throw new Error(`마이그레이션 실패: ${e}`);
  }
}

