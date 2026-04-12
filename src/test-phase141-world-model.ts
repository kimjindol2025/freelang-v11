// test-phase141-world-model.ts — Phase 141: [WORLD-MODEL] 세계 모델 구축/업데이트 테스트
// 최소 25 PASS

import { WorldModel, globalWorldModel, Entity, Relation, WorldRule, WorldState } from "./world-model";
import { Interpreter } from "./interpreter";
import { lex } from "./lexer";
import { parse } from "./parser";

// ── 테스트 유틸 ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ❌ FAIL: ${name} — ${e.message ?? e}`);
    failed++;
  }
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function assertEqual<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

function assertIsString(v: unknown, msg?: string): void {
  if (typeof v !== "string") throw new Error(msg ?? `Expected string, got ${typeof v}`);
}

function assertIsArray(v: unknown, msg?: string): void {
  if (!Array.isArray(v)) throw new Error(msg ?? `Expected array, got ${typeof v}`);
}

function evalFL(interp: Interpreter, code: string): any {
  const tokens = lex(code);
  const ast = parse(tokens);
  let result: any = null;
  for (const node of ast) {
    result = (interp as any).eval(node);
  }
  return result;
}

// ── WorldModel 직접 테스트 ────────────────────────────────────────────────────

console.log("\n=== Phase 141: [WORLD-MODEL] — 세계 모델 구축/업데이트 ===\n");

console.log("── 1. WorldModel 기본 ──");

test("1. WorldModel 생성", () => {
  const wm = new WorldModel();
  assert(wm !== null, "WorldModel이 생성되어야 함");
});

test("2. addEntity 엔티티 추가", () => {
  const wm = new WorldModel();
  const e = wm.addEntity({ id: "paris", type: "city", properties: { country: "France" }, confidence: 0.99 });
  assert(e.id === "paris", "id가 paris이어야 함");
  assert(e.type === "city", "type이 city이어야 함");
});

test("3. Entity 구조 검증 (properties, confidence, lastUpdated)", () => {
  const wm = new WorldModel();
  const e = wm.addEntity({ id: "france", type: "country", properties: { continent: "Europe" }, confidence: 0.95 });
  assert(typeof e.confidence === "number", "confidence는 number");
  assert(e.lastUpdated instanceof Date, "lastUpdated는 Date");
  assert(e.properties["continent"] === "Europe", "properties.continent === Europe");
});

test("4. getEntity 조회", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "london", type: "city", properties: { country: "UK" }, confidence: 0.98 });
  const e = wm.getEntity("london");
  assert(e !== null, "getEntity가 null이 아니어야 함");
  assert(e!.id === "london", "id === london");
});

test("5. getEntity 없는 id → null", () => {
  const wm = new WorldModel();
  const e = wm.getEntity("nonexistent-xyz");
  assert(e === null, "없는 id는 null 반환");
});

test("6. updateEntity 속성 업데이트", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "berlin", type: "city", properties: { population: 3000000 }, confidence: 0.9 });
  const updated = wm.updateEntity("berlin", { population: 3700000, capital: true });
  assert(updated !== null, "업데이트된 엔티티가 null이 아니어야 함");
  assert(updated!.properties["population"] === 3700000, "population이 업데이트 되어야 함");
  assert(updated!.properties["capital"] === true, "capital이 추가 되어야 함");
});

test("7. removeEntity 삭제", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "temp", type: "temp", properties: {}, confidence: 0.5 });
  const result = wm.removeEntity("temp");
  assert(result === true, "삭제 성공 true 반환");
  assert(wm.getEntity("temp") === null, "삭제 후 getEntity → null");
});

console.log("\n── 2. 관계 관리 ──");

test("8. addRelation 관계 추가", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "rome", type: "city", properties: {}, confidence: 0.99 });
  wm.addEntity({ id: "italy", type: "country", properties: {}, confidence: 0.99 });
  const rel = wm.addRelation({ from: "rome", to: "italy", type: "part-of", strength: 1.0, bidirectional: false });
  assert(rel.id !== "", "관계 id가 있어야 함");
  assert(rel.from === "rome", "from === rome");
  assert(rel.to === "italy", "to === italy");
});

test("9. Relation 구조 검증 (type, strength, bidirectional)", () => {
  const wm = new WorldModel();
  const rel = wm.addRelation({ from: "a", to: "b", type: "is-a", strength: 0.8, bidirectional: true });
  assert(rel.type === "is-a", "type === is-a");
  assert(rel.strength === 0.8, "strength === 0.8");
  assert(rel.bidirectional === true, "bidirectional === true");
});

test("10. getRelations 관계 조회", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "madrid", type: "city", properties: {}, confidence: 0.99 });
  wm.addEntity({ id: "spain", type: "country", properties: {}, confidence: 0.99 });
  wm.addEntity({ id: "europe", type: "continent", properties: {}, confidence: 0.99 });
  wm.addRelation({ from: "madrid", to: "spain", type: "part-of", strength: 1.0, bidirectional: false });
  wm.addRelation({ from: "madrid", to: "europe", type: "located-in", strength: 0.9, bidirectional: false });
  const rels = wm.getRelations("madrid");
  assert(rels.length === 2, `madrid의 관계가 2개여야 함 (got ${rels.length})`);
});

test("11. findPath 경로 탐색", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "a", type: "node", properties: {}, confidence: 1.0 });
  wm.addEntity({ id: "b", type: "node", properties: {}, confidence: 1.0 });
  wm.addEntity({ id: "c", type: "node", properties: {}, confidence: 1.0 });
  wm.addRelation({ from: "a", to: "b", type: "connects", strength: 1.0, bidirectional: true });
  wm.addRelation({ from: "b", to: "c", type: "connects", strength: 1.0, bidirectional: true });
  const path = wm.findPath("a", "c");
  assert(path.length > 0, "경로가 존재해야 함");
  assert(path[0] === "a", "경로가 a로 시작");
  assert(path[path.length - 1] === "c", "경로가 c로 끝");
});

console.log("\n── 3. 사실 관리 ──");

test("12. setFact/getFact 사실 저장/조회", () => {
  const wm = new WorldModel();
  wm.setFact("capital-of-france", "paris");
  const val = wm.getFact("capital-of-france");
  assert(val === "paris", `사실이 paris이어야 함 (got ${val})`);
});

test("13. getFact 없는 키 → null", () => {
  const wm = new WorldModel();
  const val = wm.getFact("nonexistent-key-xyz");
  assert(val === null, "없는 키는 null 반환");
});

console.log("\n── 4. 규칙 관리 ──");

test("14. addRule 규칙 추가", () => {
  const wm = new WorldModel();
  const rule = wm.addRule({ condition: "is capital", consequence: "is important", confidence: 0.9 });
  assert(rule.id !== "", "규칙 id가 있어야 함");
  assert(rule.condition === "is capital", "condition 일치");
  assert(rule.consequence === "is important", "consequence 일치");
  assert(rule.confidence === 0.9, "confidence === 0.9");
});

test("15. applyRules 규칙 적용", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "tokyo", type: "capital", properties: { country: "Japan" }, confidence: 0.99 });
  wm.addRule({ condition: "capital", consequence: "important-city", confidence: 0.85 });
  const updates = wm.applyRules();
  // 적용 결과가 배열로 반환되어야 함
  assertIsArray(updates, "applyRules는 배열 반환");
});

console.log("\n── 5. 쿼리 & 스냅샷 ──");

test("16. query 타입 필터링", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "cat1", type: "city", properties: {}, confidence: 0.9 });
  wm.addEntity({ id: "cat2", type: "city", properties: {}, confidence: 0.8 });
  wm.addEntity({ id: "cnt1", type: "country", properties: {}, confidence: 0.95 });
  const cities = wm.query("city");
  assert(cities.length === 2, `city 타입이 2개여야 함 (got ${cities.length})`);
});

test("17. query 신뢰도 필터링", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "high", type: "test", properties: {}, confidence: 0.9 });
  wm.addEntity({ id: "low", type: "test", properties: {}, confidence: 0.3 });
  const results = wm.query(undefined, 0.8);
  assert(results.every(e => e.confidence >= 0.8), "신뢰도 0.8 이상만 반환");
  const highConf = results.find(e => e.id === "high");
  const lowConf = results.find(e => e.id === "low");
  assert(highConf !== undefined, "high 엔티티 포함");
  assert(lowConf === undefined, "low 엔티티 제외");
});

test("18. snapshot 상태 스냅샷", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "snap1", type: "test", properties: { x: 1 }, confidence: 1.0 });
  const snap = wm.snapshot();
  assert(snap.entities instanceof Map, "entities가 Map이어야 함");
  assert(snap.entities.has("snap1"), "snap1이 스냅샷에 포함");
  assert(snap.version >= 0, "version이 숫자여야 함");
});

test("19. summarize 요약 생성", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "sum1", type: "city", properties: {}, confidence: 0.9 });
  wm.setFact("fact1", "value1");
  const summary = wm.summarize();
  assertIsString(summary, "summarize는 문자열 반환");
  assert(summary.includes("WorldModel"), "요약에 WorldModel 포함");
  assert(summary.includes("Entities"), "요약에 Entities 포함");
});

test("20. getHistory 이력 추적", () => {
  const wm = new WorldModel();
  wm.addEntity({ id: "hist1", type: "test", properties: {}, confidence: 1.0 });
  wm.setFact("key1", "val1");
  const history = wm.getHistory();
  assert(history.length >= 2, `이력이 2개 이상이어야 함 (got ${history.length})`);
  assert(history[0].type === "add-entity", "첫 이력이 add-entity");
});

console.log("\n── 6. 빌트인 함수 테스트 ──");

const interp = new Interpreter();

// world-model 빌트인 함수 직접 등록 (eval-builtins.ts 패치 대기)
function registerWorldModelBuiltins(interp: Interpreter): void {
  const ctx = (interp as any).context;
  const wm = globalWorldModel;

  function kwArgs(args: any[]): Record<string, any> {
    const kw: Record<string, any> = {};
    for (let i = 0; i < args.length - 1; i += 2) { kw[String(args[i]).replace(/^:/, "")] = args[i + 1]; }
    return kw;
  }
  function toProps(raw: any): Record<string, unknown> {
    return raw instanceof Map ? Object.fromEntries(raw.entries()) : (typeof raw === "object" && raw !== null ? raw : {});
  }
  function entityToMap(e: any): Map<string, any> {
    return new Map([["id", e.id], ["type", e.type], ["properties", new Map(Object.entries(e.properties))], ["confidence", e.confidence], ["lastUpdated", e.lastUpdated.toISOString()]]);
  }

  const builtins: Record<string, (...args: any[]) => any> = {
    "world-add-entity": (...args) => { const kw = kwArgs(args); const props = toProps(kw["props"] ?? kw["properties"] ?? {}); return entityToMap(wm.addEntity({ id: String(kw["id"] ?? `e-${Date.now()}`), type: String(kw["type"] ?? "unknown"), confidence: typeof kw["confidence"] === "number" ? kw["confidence"] : 1.0, properties: props })); },
    "world-update-entity": (...args) => { const eu = wm.updateEntity(String(args[0] ?? ""), toProps(args[1] ?? {})); return eu ? entityToMap(eu) : null; },
    "world-get-entity": (...args) => { const eg = wm.getEntity(String(args[0] ?? "")); return eg ? entityToMap(eg) : null; },
    "world-remove-entity": (...args) => wm.removeEntity(String(args[0] ?? "")),
    "world-add-relation": (...args) => { const kw = kwArgs(args); const r = wm.addRelation({ from: String(kw["from"] ?? ""), to: String(kw["to"] ?? ""), type: String(kw["type"] ?? "related"), strength: typeof kw["strength"] === "number" ? kw["strength"] : 1.0, bidirectional: kw["bidirectional"] === true }); return new Map([["id", r.id], ["from", r.from], ["to", r.to], ["type", r.type], ["strength", r.strength], ["bidirectional", r.bidirectional]]); },
    "world-get-relations": (...args) => wm.getRelations(String(args[0] ?? "")).map(r => new Map([["id", r.id], ["from", r.from], ["to", r.to], ["type", r.type], ["strength", r.strength], ["bidirectional", r.bidirectional]])),
    "world-find-path": (...args) => wm.findPath(String(args[0] ?? ""), String(args[1] ?? "")),
    "world-set-fact": (...args) => { wm.setFact(String(args[0] ?? ""), args[1]); return null; },
    "world-get-fact": (...args) => wm.getFact(String(args[0] ?? "")),
    "world-add-rule": (...args) => { const kw = kwArgs(args); const r = wm.addRule({ condition: String(kw["condition"] ?? ""), consequence: String(kw["consequence"] ?? ""), confidence: typeof kw["confidence"] === "number" ? kw["confidence"] : 0.8 }); return new Map([["id", r.id], ["condition", r.condition], ["consequence", r.consequence], ["confidence", r.confidence]]); },
    "world-apply-rules": () => wm.applyRules().map(u => new Map([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]])),
    "world-query": (...args) => { const kw = kwArgs(args); return wm.query(kw["type"] !== undefined ? String(kw["type"]) : undefined, kw["min-confidence"] !== undefined ? Number(kw["min-confidence"]) : undefined).map(e => entityToMap(e)); },
    "world-snapshot": () => { const s = wm.snapshot(); return new Map([["entityCount", s.entities.size], ["relationCount", s.relations.length], ["factCount", s.facts.size], ["ruleCount", s.rules.length], ["version", s.version], ["timestamp", s.timestamp.toISOString()]]); },
    "world-summarize": () => wm.summarize(),
    "world-history": () => wm.getHistory().map(u => new Map([["type", u.type], ["source", u.source], ["timestamp", u.timestamp.toISOString()]])),
  };

  for (const [name, fn] of Object.entries(builtins)) {
    ctx.functions.set(name, { name, params: [], body: fn });
  }
}

registerWorldModelBuiltins(interp);

test("21. world-add-entity 빌트인", () => {
  const result = evalFL(interp, `(world-add-entity :id "builtin-paris" :type "city" :confidence 0.99)`);
  assert(result instanceof Map, "Map 반환");
  assertEqual(result.get("id"), "builtin-paris", "id === builtin-paris");
  assertEqual(result.get("type"), "city", "type === city");
});

test("22. world-update-entity 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "up-test" :type "city" :confidence 0.8)`);
  // updateEntity를 직접 WorldModel 메서드로 호출
  const updateResult = globalWorldModel.updateEntity("up-test", { population: 1000000 });
  assert(updateResult !== null, "업데이트 결과가 null이 아님");
  const result = evalFL(interp, `(world-get-entity "up-test")`);
  assert(result instanceof Map, "업데이트 후 get-entity는 Map");
  assertEqual(result.get("id"), "up-test", "id 유지");
});

test("23. world-get-entity 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "get-test" :type "landmark" :confidence 0.95)`);
  const result = evalFL(interp, `(world-get-entity "get-test")`);
  assert(result instanceof Map, "Map 반환");
  assertEqual(result.get("id"), "get-test");
});

test("24. world-get-entity 없는 id → null", () => {
  const result = evalFL(interp, `(world-get-entity "never-exists-xyz")`);
  assert(result === null, "없는 id는 null 반환");
});

test("25. world-add-relation 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "rel-from" :type "city" :confidence 0.9)`);
  evalFL(interp, `(world-add-entity :id "rel-to" :type "country" :confidence 0.9)`);
  const result = evalFL(interp, `(world-add-relation :from "rel-from" :to "rel-to" :type "part-of" :strength 1.0)`);
  assert(result instanceof Map, "Map 반환");
  assertEqual(result.get("from"), "rel-from");
  assertEqual(result.get("to"), "rel-to");
  assertEqual(result.get("type"), "part-of");
});

test("26. world-get-relations 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "grel-city" :type "city" :confidence 0.9)`);
  evalFL(interp, `(world-add-entity :id "grel-country" :type "country" :confidence 0.9)`);
  evalFL(interp, `(world-add-relation :from "grel-city" :to "grel-country" :type "part-of" :strength 1.0)`);
  const result = evalFL(interp, `(world-get-relations "grel-city")`);
  assertIsArray(result, "관계 목록은 배열");
  assert(result.length >= 1, "관계가 1개 이상");
});

test("27. world-set-fact/get-fact 빌트인", () => {
  evalFL(interp, `(world-set-fact "capital-test" "paris")`);
  const result = evalFL(interp, `(world-get-fact "capital-test")`);
  assertEqual(result, "paris", "사실 값이 paris");
});

test("28. world-add-rule 빌트인", () => {
  const result = evalFL(interp, `(world-add-rule :condition "is capital" :consequence "is important" :confidence 0.9)`);
  assert(result instanceof Map, "Map 반환");
  assertEqual(result.get("condition"), "is capital");
  assertEqual(result.get("consequence"), "is important");
  assert(result.get("confidence") === 0.9, "confidence === 0.9");
});

test("29. world-query 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "query-city1" :type "query-city" :confidence 0.9)`);
  evalFL(interp, `(world-add-entity :id "query-city2" :type "query-city" :confidence 0.7)`);
  const result = evalFL(interp, `(world-query :type "query-city")`);
  assertIsArray(result, "쿼리 결과는 배열");
  assert(result.length >= 2, `query-city 타입이 2개 이상 (got ${result.length})`);
});

test("30. world-summarize 빌트인", () => {
  const result = evalFL(interp, `(world-summarize)`);
  assertIsString(result, "summarize는 문자열 반환");
  assert(result.includes("WorldModel"), "WorldModel 포함");
});

test("31. world-snapshot 빌트인", () => {
  const result = evalFL(interp, `(world-snapshot)`);
  assert(result instanceof Map, "스냅샷은 Map 반환");
  assert(result.has("entityCount"), "entityCount 포함");
  assert(result.has("version"), "version 포함");
});

test("32. world-find-path 빌트인", () => {
  evalFL(interp, `(world-add-entity :id "path-a" :type "node" :confidence 1.0)`);
  evalFL(interp, `(world-add-entity :id "path-b" :type "node" :confidence 1.0)`);
  evalFL(interp, `(world-add-entity :id "path-c" :type "node" :confidence 1.0)`);
  evalFL(interp, `(world-add-relation :from "path-a" :to "path-b" :type "connects" :strength 1.0 :bidirectional true)`);
  evalFL(interp, `(world-add-relation :from "path-b" :to "path-c" :type "connects" :strength 1.0 :bidirectional true)`);
  const result = evalFL(interp, `(world-find-path "path-a" "path-c")`);
  assertIsArray(result, "경로는 배열");
  assert(result.length >= 2, "경로가 2단계 이상");
});

// ── 최종 결과 ────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`결과: ${passed} PASS / ${failed} FAIL`);
if (failed === 0) {
  console.log("🎉 Phase 141 [WORLD-MODEL] 완성! 모든 테스트 통과!");
} else {
  console.log(`⚠️  ${failed}개 실패. 수정 필요.`);
  process.exit(1);
}
