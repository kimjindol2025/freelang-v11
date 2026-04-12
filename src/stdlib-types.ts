// FreeLang v9: Standard Library Type Signatures (Phase 60)
// 내장 함수/연산자의 런타임 타입 시그니처 정의

import { FlType } from "./type-system";

export interface BuiltinTypeSig {
  params: FlType[];
  ret: FlType;
}

/**
 * 내장 연산자/함수의 타입 시그니처
 * params: 각 인수의 기대 타입 (any → 검증 스킵)
 * ret: 반환값 타입
 */
export const BUILTIN_TYPE_SIGS: Record<string, BuiltinTypeSig> = {
  // 산술 연산자 — number로 지정해서 int/float 모두 허용
  "+":    { params: ["number", "number"], ret: "number" },
  "-":    { params: ["number", "number"], ret: "number" },
  "*":    { params: ["number", "number"], ret: "number" },
  "/":    { params: ["number", "number"], ret: "float" },
  "%":    { params: ["int", "int"],       ret: "int" },
  "**":   { params: ["number", "number"], ret: "number" },

  // 비교 연산자
  "=":    { params: ["any", "any"],       ret: "bool" },
  "!=":   { params: ["any", "any"],       ret: "bool" },
  "<":    { params: ["number", "number"], ret: "bool" },
  ">":    { params: ["number", "number"], ret: "bool" },
  "<=":   { params: ["number", "number"], ret: "bool" },
  ">=":   { params: ["number", "number"], ret: "bool" },

  // 논리 연산자
  "and":  { params: ["bool", "bool"],     ret: "bool" },
  "or":   { params: ["bool", "bool"],     ret: "bool" },
  "not":  { params: ["bool"],             ret: "bool" },

  // 문자열 함수
  "str":      { params: ["any"],              ret: "string" },
  "concat":   { params: ["string", "string"], ret: "string" },
  "upper":    { params: ["string"],           ret: "string" },
  "lower":    { params: ["string"],           ret: "string" },
  "length":   { params: ["any"],              ret: "int" },
  "substring": { params: ["string", "int", "int"], ret: "string" },
  "charAt":   { params: ["string", "int"],    ret: "string" },
  "strlen":   { params: ["string"],           ret: "int" },
  "indexof":  { params: ["string", "string"], ret: "int" },
  "trim":     { params: ["string"],           ret: "string" },
  "split":    { params: ["string", "string"], ret: "array" },
  "replace":  { params: ["string", "string", "string"], ret: "string" },

  // 숫자 함수
  "abs":   { params: ["number"],             ret: "number" },
  "floor": { params: ["float"],              ret: "int" },
  "ceil":  { params: ["float"],              ret: "int" },
  "round": { params: ["float"],              ret: "int" },
  "sqrt":  { params: ["number"],             ret: "float" },
  "max":   { params: ["number", "number"],   ret: "number" },
  "min":   { params: ["number", "number"],   ret: "number" },
  "mod":   { params: ["int", "int"],         ret: "int" },

  // 타입 변환
  "int":    { params: ["any"],               ret: "int" },
  "float":  { params: ["any"],               ret: "float" },
  "bool":   { params: ["any"],               ret: "bool" },
  "parse-int":   { params: ["string"],       ret: "int" },
  "parse-float": { params: ["string"],       ret: "float" },

  // 컬렉션 함수
  "list":   { params: ["any"],               ret: "array" },
  "first":  { params: ["array"],             ret: "any" },
  "last":   { params: ["array"],             ret: "any" },
  "rest":   { params: ["array"],             ret: "array" },
  "push":   { params: ["array", "any"],      ret: "array" },
  "append": { params: ["array", "any"],      ret: "array" },
  "get":    { params: ["any", "any"],        ret: "any" },
  "set":    { params: ["map", "any", "any"], ret: "map" },
  "keys":   { params: ["map"],               ret: "array" },
  "values": { params: ["map"],               ret: "array" },
  "map":    { params: ["array", "fn"],       ret: "array" },
  "filter": { params: ["array", "fn"],       ret: "array" },
  "reduce": { params: ["array", "fn", "any"], ret: "any" },

  // 제어 흐름 / 출력
  "print":   { params: ["any"],              ret: "null" },
  "println": { params: ["any"],              ret: "null" },
  "type-of": { params: ["any"],              ret: "string" },
  "null?":   { params: ["any"],              ret: "bool" },
  "empty?":  { params: ["any"],              ret: "bool" },
};

/**
 * 내장 함수 타입 시그니처 조회
 */
export function getBuiltinTypeSig(op: string): BuiltinTypeSig | null {
  return BUILTIN_TYPE_SIGS[op] ?? null;
}
