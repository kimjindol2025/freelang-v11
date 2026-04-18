// FreeLang v9: Phase 21 — WS + Auth + Cache + PubSub 테스트

import { createWsModule } from "./stdlib-ws";
import { createAuthModule } from "./stdlib-auth";
import { createCacheModule } from "./stdlib-cache";
import { createPubSubModule } from "./stdlib-pubsub";

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean) {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else     { console.error(`  ❌ ${label}`); fail++; }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  Phase 21: stdlib-auth 테스트");
console.log("══════════════════════════════════════════");

const A = createAuthModule();

// JWT sign + verify
const payload = { userId: "42", role: "admin" };
const secret  = "my_secret_key";
const token   = A["auth_jwt_sign"](payload, secret, 3600);
check("auth_jwt_sign: 토큰 생성", typeof token === "string" && token.split(".").length === 3);

const verified = A["auth_jwt_verify"](token, secret);
check("auth_jwt_verify: 검증 성공", verified !== null);
check("auth_jwt_verify: payload.userId 일치", verified?.userId === "42");
check("auth_jwt_verify: payload.role 일치", verified?.role === "admin");

const badToken = A["auth_jwt_verify"](token, "wrong_secret");
check("auth_jwt_verify: 잘못된 시크릿 → null", badToken === null);

const decoded = A["auth_jwt_decode"](token);
check("auth_jwt_decode: userId 포함", decoded?.userId === "42");

check("auth_jwt_expired: 유효 토큰 false", A["auth_jwt_expired"](token) === false);
// 만료된 토큰 생성 (expiry=-1)
const expiredToken = A["auth_jwt_sign"]({ x: 1 }, secret, -100);
check("auth_jwt_expired: 만료 토큰 true", A["auth_jwt_expired"](expiredToken) === true);
check("auth_jwt_verify: 만료 토큰 → null", A["auth_jwt_verify"](expiredToken, secret) === null);

// Bearer extraction
const mockReq = { headers: { authorization: `Bearer ${token}` } };
check("auth_bearer_extract: 토큰 추출", A["auth_bearer_extract"](mockReq) === token);
check("auth_bearer_extract: 없으면 null", A["auth_bearer_extract"]({ headers: {} }) === null);

// API key
const apiReq = { headers: { "x-api-key": "secret123" }, query: {}, body: {} };
check("auth_apikey_valid: 유효 키", A["auth_apikey_valid"](apiReq, ["secret123", "other"]) === true);
check("auth_apikey_valid: 잘못된 키", A["auth_apikey_valid"](apiReq, ["wrong"]) === false);
check("auth_apikey_get: 키 추출", A["auth_apikey_get"](apiReq) === "secret123");

// Password hashing
const hash = A["auth_hash_password"]("mypassword123");
check("auth_hash_password: salt:hash 형식", typeof hash === "string" && hash.includes(":"));
check("auth_verify_password: 올바른 비밀번호", A["auth_verify_password"]("mypassword123", hash) === true);
check("auth_verify_password: 틀린 비밀번호", A["auth_verify_password"]("wrong", hash) === false);

// Tokens
const token32 = A["auth_random_token"](32);
check("auth_random_token: 64자 hex", typeof token32 === "string" && token32.length === 64);

const hmac = A["auth_hmac"]("data", "secret");
check("auth_hmac: hex 출력", typeof hmac === "string" && hmac.length === 64);

const sha = A["auth_sha256"]("hello");
check("auth_sha256: hex 출력", typeof sha === "string" && sha.length === 64);

const b64 = A["auth_base64"]("hello world");
check("auth_base64: 인코딩", b64 === "aGVsbG8gd29ybGQ=");
check("auth_base64_decode: 디코딩", A["auth_base64_decode"](b64) === "hello world");

// ── Cache ──────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  Phase 21: stdlib-cache 테스트");
console.log("══════════════════════════════════════════");

const C = createCacheModule();

// 기본 set/get
C["cache_set"]("key1", "value1");
check("cache_set/get: 기본 동작", C["cache_get"]("key1") === "value1");
check("cache_has: 존재 확인", C["cache_has"]("key1") === true);
check("cache_has: 미존재 false", C["cache_has"]("nonexistent") === false);

// 객체 저장
C["cache_set"]("obj1", { name: "test", count: 42 });
const obj = C["cache_get"]("obj1") as any;
check("cache_set/get: 객체 저장", obj?.name === "test" && obj?.count === 42);

// TTL
C["cache_set"]("ttl1", "expires_soon", 50); // 50ms TTL
check("cache_get: TTL 만료 전", C["cache_get"]("ttl1") === "expires_soon");
check("cache_ttl: 남은 시간 양수", (C["cache_ttl"]("ttl1") as number) > 0);
check("cache_ttl: 영구 키 -1", C["cache_ttl"]("key1") === -1);
check("cache_ttl: 미존재 null", C["cache_ttl"]("xxx") === null);

// 삭제
C["cache_del"]("key1");
check("cache_del: 삭제 후 null", C["cache_get"]("key1") === null);

// incr
C["cache_set"]("counter", 0);
C["cache_incr"]("counter", 5);
check("cache_incr: +5", C["cache_get"]("counter") === 5);
C["cache_incr"]("counter");
check("cache_incr: +1 (기본)", C["cache_get"]("counter") === 6);

// mset/mget
C["cache_mset"]({ "a": 1, "b": 2, "c": 3 });
const multi = C["cache_mget"](["a", "b", "c", "d"]) as any;
check("cache_mset/mget: 3개 저장, d=null", multi["a"] === 1 && multi["b"] === 2 && multi["d"] === null);

// keys
const keys = C["cache_keys"]() as string[];
check("cache_keys: 존재 키 포함", keys.includes("a") && keys.includes("b"));

// clear by prefix
C["cache_set"]("prefix:1", "x"); C["cache_set"]("prefix:2", "y"); C["cache_set"]("other", "z");
const cleared = C["cache_clear"]("prefix:");
check("cache_clear: prefix로 2개 삭제", cleared === 2);
check("cache_clear: 다른 키 유지", C["cache_has"]("other") === true);

// ── PubSub ─────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  Phase 21: stdlib-pubsub 테스트");
console.log("══════════════════════════════════════════");

const received: any[] = [];
const mockCallFn = (name: string, args: any[]) => {
  received.push({ name, topic: args[0], data: args[1] });
};

const PS = createPubSubModule(mockCallFn);

const subId = PS["pubsub_subscribe"]("user.login", "on_login") as string;
check("pubsub_subscribe: ID 반환", typeof subId === "string");

PS["pubsub_subscribe"]("user.login", "on_login_2");
PS["pubsub_subscribe"]("order.created", "on_order");

check("pubsub_topics: 2개 토픽", (PS["pubsub_topics"]() as string[]).length === 2);
check("pubsub_subscribers: user.login 2개", PS["pubsub_subscribers"]("user.login") === 2);

// publish
const delivered = PS["pubsub_publish"]("user.login", { userId: "42" }) as number;
check("pubsub_publish: 2개 전달", delivered === 2);
check("pubsub_publish: 핸들러 호출", received.some(r => r.name === "on_login" && r.data?.userId === "42"));
check("pubsub_publish: 두 번째 핸들러 호출", received.some(r => r.name === "on_login_2"));

// 없는 토픽
check("pubsub_publish: 구독자 없으면 0", PS["pubsub_publish"]("no.topic", {}) === 0);

// once
received.length = 0;
PS["pubsub_once"]("temp.event", "on_temp");
PS["pubsub_publish"]("temp.event", "first");
PS["pubsub_publish"]("temp.event", "second");
check("pubsub_once: 첫 발행 호출", received.length === 1);
check("pubsub_once: 두 번째 발행 무시", received.length === 1);

// unsubscribe
received.length = 0;
PS["pubsub_unsubscribe"](subId);
PS["pubsub_publish"]("user.login", { userId: "99" });
check("pubsub_unsubscribe: 해제 후 1개만 호출", received.length === 1);
check("pubsub_unsubscribe: on_login_2만 호출", received[0]?.name === "on_login_2");

// ── WS 모듈 구조 테스트 ────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log("  Phase 21: stdlib-ws 구조 테스트");
console.log("══════════════════════════════════════════");

const WS = createWsModule(mockCallFn);
check("ws_start 함수 존재", typeof WS["ws_start"] === "function");
check("ws_stop 함수 존재", typeof WS["ws_stop"] === "function");
check("ws_send 함수 존재", typeof WS["ws_send"] === "function");
check("ws_send_json 함수 존재", typeof WS["ws_send_json"] === "function");
check("ws_broadcast 함수 존재", typeof WS["ws_broadcast"] === "function");
check("ws_broadcast_json 함수 존재", typeof WS["ws_broadcast_json"] === "function");
check("ws_close 함수 존재", typeof WS["ws_close"] === "function");
check("ws_clients 함수 존재", typeof WS["ws_clients"] === "function");
check("ws_count 함수 존재", typeof WS["ws_count"] === "function");
check("ws_on_connect_fn 함수 존재", typeof WS["ws_on_connect_fn"] === "function");
check("ws_on_message_fn 함수 존재", typeof WS["ws_on_message_fn"] === "function");

// 연결 없는 상태
check("ws_clients: 초기 빈 배열", (WS["ws_clients"]() as string[]).length === 0);
check("ws_count: 초기 0", WS["ws_count"]() === 0);
check("ws_send: 없는 연결 false", WS["ws_send"]("nonexistent", "hi") === false);
check("ws_broadcast: 연결 없을 때 0", WS["ws_broadcast"]("hello") === 0);

// 핸들러 이름 설정
WS["ws_on_connect_fn"]("my_connect_handler");
WS["ws_on_message_fn"]("my_message_handler");
check("ws_on_connect_fn: 오류 없음", true);

// ── 결과 ─────────────────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════");
console.log(`결과: ${pass}/${pass + fail} PASS`);
console.log("══════════════════════════════════════════");

if (fail > 0) process.exit(1);
