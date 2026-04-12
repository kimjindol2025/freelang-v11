// fl-http-client package test
import { createMockHttpClient, registerFlHttpClient } from "./index";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  const result = (async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
      passed++;
    } catch (e: any) {
      console.log(`  ❌ ${name}: ${String(e.message ?? e).slice(0, 100)}`);
      failed++;
    }
  })();
  return result;
}

async function main() {
  console.log("=== fl-http-client package tests ===");

  const mock = createMockHttpClient();
  mock.addRoute("GET", "https://api.example.com/data", {
    status: 200,
    body: '{"hello":"world"}',
    headers: { "content-type": "application/json" },
  });
  mock.addRoute("POST", "https://api.example.com/create", {
    status: 201,
    body: '{"id":42}',
    headers: {},
  });
  mock.addRoute("DELETE", "https://api.example.com/item/1", {
    status: 204,
    body: "",
    headers: {},
  });

  await test("mock GET returns correct status", async () => {
    const res = await mock.get("https://api.example.com/data");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  });

  await test("mock GET returns correct body", async () => {
    const res = await mock.get("https://api.example.com/data");
    if (res.body !== '{"hello":"world"}') throw new Error("body mismatch");
  });

  await test("mock GET returns headers", async () => {
    const res = await mock.get("https://api.example.com/data");
    if (res.headers["content-type"] !== "application/json")
      throw new Error("header mismatch");
  });

  await test("mock POST returns 201", async () => {
    const res = await mock.post(
      "https://api.example.com/create",
      '{"name":"test"}'
    );
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
  });

  await test("mock POST body parsed correctly", async () => {
    const res = await mock.post(
      "https://api.example.com/create",
      '{"name":"test"}'
    );
    const parsed = JSON.parse(res.body);
    if (parsed.id !== 42) throw new Error("id mismatch");
  });

  await test("mock DELETE returns 204", async () => {
    const res = await mock.delete("https://api.example.com/item/1");
    if (res.status !== 204) throw new Error(`Expected 204, got ${res.status}`);
  });

  await test("mock unregistered route returns default 200", async () => {
    const res = await mock.get("https://unknown.com/path");
    if (res.status !== 200) throw new Error("Expected default 200");
  });

  await test("mock json() parses response", async () => {
    const data = await mock.json("https://api.example.com/data");
    if (data.hello !== "world") throw new Error("json parse failed");
  });

  console.log(`\nfl-http-client: ${passed} passed, ${failed} failed`);
}

main().catch(console.error);
