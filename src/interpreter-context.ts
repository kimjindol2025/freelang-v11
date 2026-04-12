// FreeLang v9: Interpreter Context Types
// Phase 58: interpreter.ts에서 분리된 타입 정의들

import { ASTNode, TypeAnnotation } from "./ast";
import { TypeChecker } from "./type-checker";
import { RuntimeTypeChecker } from "./type-system"; // Phase 60
import { ScopeStack } from "./interpreter-scope";
import { MacroExpander } from "./macro-expander"; // Phase 63: 매크로 시스템

// ExecutionContext: 런타임 상태 관리
export interface ExecutionContext {
  functions: Map<string, FreeLangFunction>;
  routes: Map<string, FreeLangRoute>;
  intents: Map<string, Intent>;
  variables: ScopeStack;
  server?: any;
  middleware: FreeLangMiddleware[];
  errorHandlers: ErrorHandler;
  startTime: number;
  lastValue?: any; // Last evaluated value (for REPL/testing)
  typeChecker?: TypeChecker; // Phase 3: Type system
  runtimeTypeChecker?: RuntimeTypeChecker; // Phase 60: 런타임 타입 검증 (strict 모드)
  typeClasses?: Map<string, TypeClassInfo>; // Phase 5 Week 2: Type class registry
  typeClassInstances?: Map<string, TypeClassInstanceInfo>; // Phase 5 Week 2: Type class instances
  modules?: Map<string, ModuleInfo>; // Phase 6: Module registry
  cache?: Map<string, any>; // Phase 9a: Search result caching
  learned?: Map<string, any>; // Phase 9b: Learned data storage (key -> data)
  reasoning?: Map<string, any>; // Phase 9c: Reasoning state storage (stage-timestamp -> reasoning state)
  currentSearches?: Map<string, any>; // Phase 9a: Current reasoning sequence search results
  currentLearned?: Map<string, any>; // Phase 9b: Current reasoning sequence learned data
  macroExpander: MacroExpander; // Phase 63: 매크로 확장기
}

export interface FreeLangFunction {
  name: string;
  params: string[];
  body: ASTNode;
  generics?: string[]; // Generic type variables: [T, K, V] (Phase 4)
  paramTypes?: TypeAnnotation[]; // Parameter types for type checking (Phase 3)
  returnType?: TypeAnnotation; // Return type for type checking (Phase 3)
  capturedEnv?: Map<string, any>; // Phase A: 클로저 환경 (fn으로 define된 함수)
}

export interface FreeLangRoute {
  name: string;
  method: string;
  path: string;
  handler: ASTNode;
}

export interface Intent {
  name: string;
  fields: Map<string, ASTNode>;
}

export interface FreeLangMiddleware {
  name: string;
  config: Map<string, any>;
}

export interface ErrorHandler {
  handlers: Map<number | "default", ASTNode>;
}

// Phase 5 Week 2: Type Class System
export interface TypeClassInfo {
  name: string;
  typeParams: string[];
  methods: Map<string, string>;  // method name → type signature
}

export interface TypeClassInstanceInfo {
  className: string;
  concreteType: string;
  implementations: Map<string, any>;  // method name → implementation function
}

// Phase 6: Module System
export interface ModuleInfo {
  name: string;
  exports: string[];  // 내보낸 함수 이름들
  functions: Map<string, FreeLangFunction>;  // 모듈 내 정의된 함수들
}
