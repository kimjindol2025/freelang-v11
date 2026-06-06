// stdlib-kebab-aliases.ts — v11.5.0
//
// 모든 snake_case stdlib 함수에 kebab-case alias 자동 등록.
// "Phase X 통일"의 첫 단계 (실제 코드 변경).
//
// 동작:
//   str_to_num  →  str-to-num   둘 다 작동
//   json_parse  →  json-parse   둘 다 작동
//   http_get    →  http-get     둘 다 작동
//
// 기존 snake_case 함수는 그대로 유지 (deprecated 예고만, 제거는 v11.6+).
//
// 예외 (변환 안 함):
//   - 이미 kebab인 함수: str-trim, nil?, str-length 등
//   - 이름 충돌: 같은 kebab 이름이 이미 있으면 skip
//   - 특수 함수: define, fn, defn 등 syntax form은 alias 불필요
//
// 사용:
//   src/stdlib-loader.ts에서 모든 모듈 등록 후 마지막에 호출
//   const all = [...allRegisteredFns];
//   interp.registerModule(createKebabAliases(all));

const SKIP_NAMES = new Set([
  // syntax form (interpreter case문에서 처리, alias 불필요)
  "define", "fn", "defn", "if", "cond", "let", "do", "match",
  "try", "catch", "finally", "throw", "loop", "recur",
  "set!", "swap!", "reset!", "deref", "atom",
  "and", "or", "not",
  // 단일 글자 / 연산자
  "+", "-", "*", "/", "<", ">", "<=", ">=", "=", "!=",
]);

// 술어성 함수 — kebab-case + ? suffix alias 추가 등록
// 예: file_exists → file-exists (구조적) + file-exists? (술어 통일)
const PREDICATE_NAMES = new Set([
  "file_exists",
  "file_is_dir",
  "fl_require",   // fl-require? 도 추가
]);

/**
 * 함수가 kebab-case alias가 필요한지 판단.
 * - underscore 포함하고
 * - 이미 kebab 버전이 없는 경우만
 */
function needsKebabAlias(name: string, existing: Set<string>): boolean {
  if (SKIP_NAMES.has(name)) return false;
  if (!name.includes("_")) return false;
  const kebab = snakeToKebab(name);
  if (kebab === name) return false;
  if (existing.has(kebab)) return false;
  return true;
}

function snakeToKebab(name: string): string {
  // server_req_body → server-req-body
  // is_null         → nil? 같이 의미적 변경은 안 함 (구조적 변환만)
  return name.replace(/_/g, "-");
}

/**
 * 모듈 객체 배열에서 모든 함수 이름과 함수를 모아 kebab alias 모듈 생성.
 *
 * @param modules stdlib-loader에서 등록한 모듈들
 * @returns kebab alias 매핑 객체 (registerModule에 전달 가능)
 */
export function createKebabAliasesModule(
  modules: Array<Record<string, unknown>>
): Record<string, unknown> {
  const aliases: Record<string, unknown> = {};
  const allNames = new Set<string>();

  // 1차: 기존 이름 모두 수집 (충돌 검사용)
  for (const mod of modules) {
    if (!mod) continue;
    for (const name of Object.keys(mod)) {
      allNames.add(name);
    }
  }

  // 2차: snake → kebab alias 등록
  let added = 0;
  for (const mod of modules) {
    if (!mod) continue;
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn !== "function") continue;
      if (!needsKebabAlias(name, allNames)) continue;
      const kebab = snakeToKebab(name);
      if (!aliases[kebab]) {
        aliases[kebab] = fn;
        allNames.add(kebab);
        added++;
      }
      // 술어성 함수: ? suffix alias 추가 (예: file-exists?)
      if (PREDICATE_NAMES.has(name)) {
        const predicate = kebab + "?";
        if (!aliases[predicate] && !allNames.has(predicate)) {
          aliases[predicate] = fn;
          allNames.add(predicate);
          added++;
        }
      }
    }
  }

  if (process.env.FL_DEBUG_KEBAB) {
    console.error(`[kebab-aliases] +${added} (예: ${Object.keys(aliases).slice(0, 5).join(", ")} ...)`);
  }

  return aliases;
}

/**
 * 통계용 — 등록된 alias 목록 반환
 */
export function listKebabAliases(modules: Array<Record<string, unknown>>): Array<[string, string]> {
  const allNames = new Set<string>();
  for (const mod of modules) {
    if (!mod) continue;
    for (const name of Object.keys(mod)) allNames.add(name);
  }
  const list: Array<[string, string]> = [];
  for (const mod of modules) {
    if (!mod) continue;
    for (const name of Object.keys(mod)) {
      if (!needsKebabAlias(name, allNames)) continue;
      list.push([name, snakeToKebab(name)]);
    }
  }
  return list;
}
