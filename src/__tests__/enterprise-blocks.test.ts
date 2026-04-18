import { lex } from "../lexer";

describe("Phase 11: Enterprise Blocks - Lexer Coverage", () => {
  test("should lex SERVICE keyword", () => {
    const tokens = lex("[SERVICE test]");
    expect(tokens.some(t => t.value === "SERVICE")).toBe(true);
  });

  test("should lex CONTROLLER keyword", () => {
    const tokens = lex("[CONTROLLER test]");
    expect(tokens.some(t => t.value === "CONTROLLER")).toBe(true);
  });

  test("should lex GUARD keyword", () => {
    const tokens = lex("[GUARD test]");
    expect(tokens.some(t => t.value === "GUARD")).toBe(true);
  });

  test("should lex MODEL keyword", () => {
    const tokens = lex("[MODEL test]");
    expect(tokens.some(t => t.value === "MODEL")).toBe(true);
  });

  test("should lex REPOSITORY keyword", () => {
    const tokens = lex("[REPOSITORY test]");
    expect(tokens.some(t => t.value === "REPOSITORY")).toBe(true);
  });

  test("should lex KAFKA keyword", () => {
    const tokens = lex("[KAFKA test]");
    expect(tokens.some(t => t.value === "KAFKA")).toBe(true);
  });

  test("should lex JWT keyword", () => {
    const tokens = lex("[JWT test]");
    expect(tokens.some(t => t.value === "JWT")).toBe(true);
  });

  test("should lex DOCKERFILE keyword", () => {
    const tokens = lex("[DOCKERFILE test]");
    expect(tokens.some(t => t.value === "DOCKERFILE")).toBe(true);
  });

  test("should lex K8S-DEPLOYMENT keyword", () => {
    const tokens = lex("[K8S-DEPLOYMENT test]");
    expect(tokens.some(t => t.value === "K8S-DEPLOYMENT")).toBe(true);
  });

  test("should lex AWS keyword", () => {
    const tokens = lex("[AWS test]");
    expect(tokens.some(t => t.value === "AWS")).toBe(true);
  });

  test("should lex GCP keyword", () => {
    const tokens = lex("[GCP test]");
    expect(tokens.some(t => t.value === "GCP")).toBe(true);
  });

  test("should lex AZURE keyword", () => {
    const tokens = lex("[AZURE test]");
    expect(tokens.some(t => t.value === "AZURE")).toBe(true);
  });
});
