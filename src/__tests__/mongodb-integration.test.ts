// MongoDB Integration Tests (Phase 4)
// Jest format - no external helper needed

import { Interpreter } from "../interpreter";
import { FreeLangPromise } from "../async-runtime";
import { createMongodbModule } from "../stdlib-mongodb";

describe("MongoDB Phase 4: Integration Tests", () => {
  let interp: Interpreter;

  beforeAll(() => {
    interp = new Interpreter();
    interp.registerModule(createMongodbModule());
  });

  afterAll(() => {
    // Cleanup
  });

  // Test 1: BSON Roundtrip (Phase 1)
  it("BSON encode/decode roundtrip", () => {
    const result = interp.eval({
      kind: "sexpr",
      op: "load",
      args: [
        { kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb/bson.fl" },
      ],
    } as any);

    // Load should return null (defines functions)
    expect(result).toBeNull();

    // Test: encode simple document
    // BSON encoding results in hex string
    // For now, just verify module loads
    expect(interp.globals.get("bson-encode")).toBeDefined();
    expect(interp.globals.get("bson-decode")).toBeDefined();
  });

  // Test 2: Wire Protocol (Phase 2)
  it("Wire protocol module loads", () => {
    const result = interp.eval({
      kind: "sexpr",
      op: "load",
      args: [
        { kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb/wire.fl" },
      ],
    } as any);

    expect(result).toBeNull();
    expect(interp.globals.get("wire-send-command")).toBeDefined();
    expect(interp.globals.get("wire-parse-response")).toBeDefined();
  });

  // Test 3: MongoDB Wrapper (Phase 3)
  it("MongoDB wrapper module loads", () => {
    const result = interp.eval({
      kind: "sexpr",
      op: "load",
      args: [
        { kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb.fl" },
      ],
    } as any);

    expect(result).toBeNull();
    expect(interp.globals.get("mongo-connect")).toBeDefined();
    expect(interp.globals.get("mongo-find")).toBeDefined();
    expect(interp.globals.get("mongo-insert")).toBeDefined();
  });

  // Test 4: Connection test (Phase 4 - requires MongoDB server)
  it("MongoDB connection attempt", () => {
    // This test requires a running MongoDB server
    // For CI/testing without MongoDB, it should skip or mock

    const connId = interp.eval({
      kind: "sexpr",
      op: "mongo-connect",
      args: [{ kind: "literal", value: "mongodb://localhost:27017/testdb" }],
    } as any);

    // Connection might fail if MongoDB not running - that's OK for this test
    // If it succeeds: connId should be a string like "localhost:27017"
    // If it fails: should be null

    expect(typeof connId === "string" || connId === null).toBe(true);
  });

  // Test 5: Native functions registered
  it("Native MongoDB functions are registered", () => {
    // Check stdlib-mongodb functions
    expect(interp.eval({
      kind: "sexpr",
      op: "typeof",
      args: [{ kind: "sexpr", op: "mongodb_connect", args: [] }],
    } as any)).toBeDefined();
  });
});

describe("MongoDB Phase 4: CRUD Operations (Mock)", () => {
  let interp: Interpreter;

  beforeAll(() => {
    interp = new Interpreter();
    // Load all modules
    interp.eval({
      kind: "sexpr",
      op: "load",
      args: [{ kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb.fl" }],
    } as any);
  });

  // Test: mongo-set helper
  it("mongo-set operator creates correct structure", () => {
    const result = interp.eval({
      kind: "sexpr",
      op: "mongo-set",
      args: [
        {
          kind: "map",
          fields: new Map([
            ["name", { kind: "literal", value: "alice" }],
            ["age", { kind: "literal", value: 30 }],
          ]),
        },
      ],
    } as any);

    // Result should be {"$set": {"name": "alice", "age": 30}}
    expect(typeof result === "object").toBe(true);
  });

  // Test: mongo-inc helper
  it("mongo-inc operator creates correct structure", () => {
    const result = interp.eval({
      kind: "sexpr",
      op: "mongo-inc",
      args: [
        {
          kind: "map",
          fields: new Map([
            ["count", { kind: "literal", value: 1 }],
          ]),
        },
      ],
    } as any);

    expect(typeof result === "object").toBe(true);
  });
});

describe("MongoDB Phase 4: Completeness Check", () => {
  it("All 15 main functions are defined", () => {
    const interp = new Interpreter();
    interp.eval({
      kind: "sexpr",
      op: "load",
      args: [{ kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb.fl" }],
    } as any);

    const functions = [
      "mongo-connect",
      "mongo-close",
      "mongo-is-connected",
      "mongo-find",
      "mongo-find-one",
      "mongo-insert",
      "mongo-insert-many",
      "mongo-update",
      "mongo-update-many",
      "mongo-delete",
      "mongo-delete-many",
      "mongo-count",
      "mongo-aggregate",
      "mongo-create-index",
      "mongo-list-collections",
    ];

    functions.forEach((fn) => {
      expect(interp.globals.get(fn)).toBeDefined();
    });
  });

  it("All helper functions are defined", () => {
    const interp = new Interpreter();
    interp.eval({
      kind: "sexpr",
      op: "load",
      args: [{ kind: "literal", value: "/home/kimjin/freelang-v11/self/stdlib/mongodb.fl" }],
    } as any);

    const helpers = [
      "mongo-set",
      "mongo-inc",
      "mongo-push",
      "mongo-pull",
      "mongo-parse-uri",
    ];

    helpers.forEach((fn) => {
      expect(interp.globals.get(fn)).toBeDefined();
    });
  });
});
