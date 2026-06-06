// src/runtime-entry.ts — Y4-3 풀 이관 단계A 진입점
//
// self/runtime/interpreter.js 를 esbuild 로 번들할 때의 단일 entry.
// REPL/dynamic eval 산출물에서 require 가능한 표면.

export { Interpreter, interpret } from "./interpreter";
export { lex } from "./lexer";
export { parse } from "./parser";
