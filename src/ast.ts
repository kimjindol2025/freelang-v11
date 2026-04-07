// FreeLang v9: AST Node definitions

export type ASTNode =
  | Block
  | Literal
  | Variable
  | SExpr
  | Keyword
  | TypeVariable
  | PatternMatch
  | Pattern
  | FunctionValue
  | TypeClass
  | TypeClassInstance
  | ModuleBlock
  | ImportBlock
  | OpenBlock
  | SearchBlock
  | LearnBlock
  | ReasoningBlock
  | ReasoningSequence
  | AsyncFunction
  | AwaitExpression
  | TryBlock
  | CatchClause
  | ThrowExpression;

// [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
export interface Block {
  kind: "block";
  type: string; // "INTENT", "FUNC", "PROMPT", "PIPE", "AGENT"
  name: string;
  fields: Map<string, ASTNode | ASTNode[]>;
  typeAnnotations?: Map<string, TypeAnnotation>; // :params and :return types (Phase 3)
  generics?: string[]; // Generic type variables: ["T", "K", "V"] (Phase 4)
}

// Literal values
export interface Literal {
  kind: "literal";
  type: "number" | "string" | "symbol" | "boolean" | "null";
  value: string | number | boolean | null;
}

// $varname
export interface Variable {
  kind: "variable";
  name: string;
}

// (symbol arg1 arg2 ...)
export interface SExpr {
  kind: "sexpr";
  op: string;
  args: ASTNode[];
  line?: number; // FreeLang source line number (for error reporting)
}

// :keyword
export interface Keyword {
  kind: "keyword";
  name: string;
}

// Type annotation (NEW for Phase 3)
export interface TypeAnnotation {
  kind: "type";
  name: string;              // "int", "string", "bool", "array<int>", "map<string,int>", "Promise<int>", "T"
  generic?: TypeAnnotation;  // for array<T>, map<K,V>, Promise<T>
  union?: TypeAnnotation[];  // for Type1 | Type2
  optional?: boolean;        // for Type?
  isTypeVariable?: boolean;  // true if this is a generic type variable (Phase 4)
}

// Type variable reference (NEW for Phase 4 Generics)
export interface TypeVariable {
  kind: "type-variable";
  name: string;  // "T", "K", "V", etc.
}

// Pattern nodes (NEW for Phase 4 Week 3-4 - Pattern Matching)

// Literal pattern: matches exact literal value (1, "hello", true)
export interface LiteralPattern {
  kind: "literal-pattern";
  type: "number" | "string" | "symbol" | "boolean";
  value: string | number | boolean;
}

// Variable pattern: binds matched value to variable (x, y)
export interface VariablePattern {
  kind: "variable-pattern";
  name: string;  // variable name (without $)
}

// Wildcard pattern: matches any value, doesn't bind (_)
export interface WildcardPattern {
  kind: "wildcard-pattern";
}

// List pattern: destructures lists ([x & xs], [x y z])
export interface ListPattern {
  kind: "list-pattern";
  elements: Pattern[];
  restElement?: string;  // for [x & rest] syntax
}

// Struct pattern: destructures objects ({:name :age})
export interface StructPattern {
  kind: "struct-pattern";
  fields: Map<string, Pattern>;  // field name -> pattern
}

// Or pattern: alternative patterns (1 | 2 | 3)
export interface OrPattern {
  kind: "or-pattern";
  alternatives: Pattern[];  // list of alternative patterns to try
}

// Union of all pattern types
export type Pattern = LiteralPattern | VariablePattern | WildcardPattern | ListPattern | StructPattern | OrPattern;

// Pattern match expression: (match value case1 case2 ...)
export interface PatternMatch {
  kind: "pattern-match";
  value: ASTNode;           // expression to match
  cases: MatchCase[];       // pattern -> result pairs
  defaultCase?: ASTNode;    // optional default case
}

// Single case in pattern match: (pattern body)
export interface MatchCase {
  pattern: Pattern;
  guard?: ASTNode;          // optional guard condition (if expr)
  body: ASTNode;            // result expression
}

// Function value (NEW for Phase 4 Week 1 - First-class functions)
export interface FunctionValue {
  kind: "function-value";
  params: string[];          // parameter names
  body: ASTNode;            // function body
  capturedEnv: Map<string, any>;  // closure environment
  name?: string;            // optional function name
}

// Type Class Definition (NEW for Phase 5 Week 2)
// [TYPECLASS Monad [M]
//   :methods [
//     :pure (fn [a] (M a))
//     :bind (fn [m f] (M b))
//     :map (fn [m f] (M b))
//   ]
// ]
export interface TypeClass {
  kind: "type-class";
  name: string;                           // e.g., "Monad", "Functor"
  typeParams: string[];                   // e.g., ["M"] or ["F"]
  methods: Map<string, TypeClassMethod>; // method name → method signature
}

export interface TypeClassMethod {
  name: string;
  type: ASTNode;  // Function type (fn [a] (M a)), stored as AST
}

// Type Class Instance (NEW for Phase 5 Week 2)
// [INSTANCE (Monad Result)
//   :pure (fn [x] (ok x))
//   :bind (fn [m f] (match m ...))
//   :map (fn [m f] (match m ...))
// ]
export interface TypeClassInstance {
  kind: "type-class-instance";
  className: string;           // e.g., "Monad"
  concreteType: string;        // e.g., "Result"
  implementations: Map<string, ASTNode>;  // method name → implementation (function value)
}

// Module Definition (NEW for Phase 5 Week 3)
// [MODULE math
//   :exports [add subtract multiply]
//   :body [
//     [FUNC add ...]
//     [FUNC subtract ...]
//   ]
// ]
export interface ModuleBlock {
  kind: "module";
  name: string;
  exports: string[];           // exported function/intent names
  body: ASTNode[];             // module body (FUNC, INTENT blocks)
  path?: string;               // optional file path for external modules
}

// Import Block (NEW for Phase 5 Week 3)
// (import math)
// (import math :from "./math.fl")
// (import math :only [add multiply])
// (import math :as m)
export interface ImportBlock {
  kind: "import";
  moduleName: string;
  source?: string;             // optional :from path
  selective?: string[];        // optional :only [names]
  alias?: string;              // optional :as alias
}

// Open Block (NEW for Phase 5 Week 3)
// (open math)  -- imports all exports to global scope
export interface OpenBlock {
  kind: "open";
  moduleName: string;
  source?: string;             // optional :from path
}

// Search Block (NEW for Phase 9a)
// [search query :source "web"|"api"|"kb" :cache true|false :limit 5]
// Represents searching external data sources
export interface SearchBlock {
  kind: "search-block";
  query: string;              // search query
  source: "web" | "api" | "kb"; // data source: web (WebSearch), api (REST API), kb (Knowledge Base)
  cache?: boolean;            // whether to cache results (default: false)
  limit?: number;             // max number of results (default: 10)
  name?: string;              // optional name for this search
}

// Learn Block (NEW for Phase 9b)
// (learn key data :source "search" :confidence 0.95)
// Represents learning and storing new information
export interface LearnBlock {
  kind: "learn-block";
  key: string;                 // learning key (identifier)
  data: any;                   // data to learn
  source?: "search" | "feedback" | "analysis"; // source of knowledge
  confidence?: number;         // confidence score (0-1)
  timestamp?: string;          // when learned (ISO 8601)
}

// Reasoning Block (NEW for Phase 9c)
// (observe "facts") → (analyze :angle1 "perf" :angle2 "security") → (decide :choice "angle2")
// Represents AI reasoning with state transitions: observe → analyze → decide → act → verify
export interface ReasoningBlock {
  kind: "reasoning-block";
  stage: "observe" | "analyze" | "decide" | "act" | "verify"; // current reasoning stage
  data: Map<string, any>;      // stage-specific data
  observations?: any[];        // facts gathered (observe stage)
  analysis?: any[];            // analysis results (analyze stage)
  decisions?: any[];           // decisions made (decide stage)
  actions?: any[];             // actions taken (act stage)
  verifications?: any[];       // verification results (verify stage)
  transitions?: ReasoningTransition[]; // state transitions
  metadata?: {                 // metadata for reasoning
    startTime?: string;        // when reasoning started (ISO 8601)
    endTime?: string;          // when reasoning ended (ISO 8601)
    confidence?: number;       // overall confidence (0-1)
    feedback?: string;         // feedback from verification
  };
  // Phase 9c: Conditional branching (if/when/then/else)
  conditional?: {
    condition: ASTNode;        // condition to evaluate (e.g., "confidence > 0.8")
    thenBlock: ReasoningBlock; // block to execute if true
    elseBlock?: ReasoningBlock; // block to execute if false (optional)
  };
  // Phase 9c: When (guard clause - block only executes if condition is true)
  whenGuard?: ASTNode;         // guard condition (block skipped if false)
  // Phase 9c: Loop Control (repeat-until / repeat-while)
  loopControl?: {
    type: "repeat-until" | "repeat-while"; // loop type
    condition: ASTNode;       // termination condition
    maxIterations?: number;   // safety limit (default: 1000)
  };
}

// Reasoning Transition (NEW for Phase 9c)
// Describes transition from one reasoning stage to next
export interface ReasoningTransition {
  from: string;                // source stage
  to: string;                  // target stage
  condition?: ASTNode;         // guard condition for transition
  action?: ASTNode;            // action to execute on transition
}

// Reasoning Sequence (NEW for Phase 9c Extension)
// (reasoning-sequence (observe ...) (analyze ...) (decide ...) (act ...) (verify ...))
// Represents a complete reasoning flow with automatic state transitions
export interface ReasoningSequence {
  kind: "reasoning-sequence";
  stages: (ReasoningBlock | SearchBlock | LearnBlock)[]; // Phase 9a/9b: allow search/learn blocks
  metadata?: {
    startTime?: string;
    endTime?: string;
    totalConfidence?: number;
    executionPath?: string[];         // sequence of stages executed
  };
  // Phase 9a/9b: Store search and learn results for access in subsequent stages
  context?: {
    searches?: Map<string, any>;       // cached search results
    learned?: Map<string, any>;        // stored learned data
  };
  feedbackLoop?: {
    enabled: boolean;                  // Phase 9c Feedback: enable feedback loop
    fromStage: "verify" | "act";      // which stage triggers feedback
    toStage: "analyze" | "decide";    // which stage to return to
    condition?: ASTNode;               // feedback condition (e.g., confidence < 0.8)
    maxIterations?: number;            // max loop iterations (default: 3)
    confidenceDamping?: number;        // confidence reduction per iteration (default: 0.1)
  };
}

// Async Function (NEW for Phase 7)
// [async name [params] body]
// Returns Promise<T> where T is the return type of body
export interface AsyncFunction {
  kind: "async-function";
  name: string;                // function name
  params: Array<{ name: string; type?: TypeAnnotation }>;  // parameter list
  body: ASTNode;              // function body
}

// Await Expression (NEW for Phase 7)
// (await promise-expression)
// Extracts value from Promise<T> → T
export interface AwaitExpression {
  kind: "await";
  argument: ASTNode;           // expression that evaluates to Promise<T>
}

// Try-Catch-Finally Block (NEW for Phase 11)
// (try body (catch [pattern] handler) (finally cleanup))
// Represents error handling with catch clauses and optional finally block
export interface TryBlock {
  kind: "try-block";
  body: ASTNode;              // try body
  catchClauses?: CatchClause[]; // catch clauses (optional)
  finallyBlock?: ASTNode;     // finally block (optional)
}

// Catch Clause (NEW for Phase 11)
// Part of try-catch: (catch [IOError err] (print "File error: " err))
export interface CatchClause {
  kind: "catch-clause";
  pattern?: Pattern;          // optional error pattern (e.g., [IOError], [err])
  variable?: string;          // optional error variable name
  handler: ASTNode;           // catch body
}

// Throw Expression (NEW for Phase 11)
// (throw error-expression) or (throw "message")
// Throws an error/exception
export interface ThrowExpression {
  kind: "throw";
  argument: ASTNode;          // error expression to throw
}

// Function signature (NEW for Phase 3)
export interface FuncSignature {
  name: string;
  params: Array<{ name: string; type: TypeAnnotation }>;
  returnType: TypeAnnotation;
}

// Parser state
export interface ParserState {
  tokens: any[];
  pos: number;
}

// Helpers
export function makeLiteral(type: "number" | "string" | "symbol" | "boolean" | "null", value: any): Literal {
  return { kind: "literal", type, value };
}

export function makeVariable(name: string): Variable {
  return { kind: "variable", name };
}

export function makeSExpr(op: string, args: ASTNode[], line?: number): SExpr {
  return { kind: "sexpr", op, args, line };
}

export function makeKeyword(name: string): Keyword {
  return { kind: "keyword", name };
}

export function makeBlock(type: string, name: string, fields: Map<string, ASTNode | ASTNode[]>): Block {
  return { kind: "block", type, name, fields };
}

// Helper: Create type annotation (Phase 3)
export function makeTypeAnnotation(
  name: string,
  generic?: TypeAnnotation,
  union?: TypeAnnotation[],
  optional?: boolean
): TypeAnnotation {
  return { kind: "type", name, generic, union, optional };
}

// Helper: Create function signature (Phase 3)
export function makeFuncSignature(
  name: string,
  params: Array<{ name: string; type: TypeAnnotation }>,
  returnType: TypeAnnotation
): FuncSignature {
  return { name, params, returnType };
}

// Helper: Create type variable (Phase 4)
export function makeTypeVariable(name: string): TypeVariable {
  return { kind: "type-variable", name };
}

// Helper: Create function value (Phase 4 Week 1)
export function makeFunctionValue(
  params: string[],
  body: ASTNode,
  capturedEnv: Map<string, any>,
  name?: string
): FunctionValue {
  return { kind: "function-value", params, body, capturedEnv, name };
}

// Helpers: Create patterns (Phase 4 Week 3-4)

export function makeLiteralPattern(
  type: "number" | "string" | "symbol" | "boolean",
  value: string | number | boolean
): LiteralPattern {
  return { kind: "literal-pattern", type, value };
}

export function makeVariablePattern(name: string): VariablePattern {
  return { kind: "variable-pattern", name };
}

export function makeWildcardPattern(): WildcardPattern {
  return { kind: "wildcard-pattern" };
}

export function makeListPattern(elements: Pattern[], restElement?: string): ListPattern {
  return { kind: "list-pattern", elements, restElement };
}

export function makeStructPattern(fields: Map<string, Pattern>): StructPattern {
  return { kind: "struct-pattern", fields };
}

export function makeOrPattern(alternatives: Pattern[]): OrPattern {
  return { kind: "or-pattern", alternatives };
}

export function makeMatchCase(pattern: Pattern, body: ASTNode, guard?: ASTNode): MatchCase {
  return { pattern, guard, body };
}

export function makePatternMatch(value: ASTNode, cases: MatchCase[], defaultCase?: ASTNode): PatternMatch {
  return { kind: "pattern-match", value, cases, defaultCase };
}

// Helper: Create type class (Phase 5 Week 2)
export function makeTypeClass(
  name: string,
  typeParams: string[],
  methods: Map<string, TypeClassMethod>
): TypeClass {
  return { kind: "type-class", name, typeParams, methods };
}

// Helper: Create type class instance (Phase 5 Week 2)
export function makeTypeClassInstance(
  className: string,
  concreteType: string,
  implementations: Map<string, ASTNode>
): TypeClassInstance {
  return { kind: "type-class-instance", className, concreteType, implementations };
}

// Helper: Create module block (Phase 5 Week 3)
export function makeModuleBlock(
  name: string,
  exports: string[],
  body: ASTNode[],
  path?: string
): ModuleBlock {
  return { kind: "module", name, exports, body, path };
}

// Helper: Create import block (Phase 5 Week 3)
export function makeImportBlock(
  moduleName: string,
  source?: string,
  selective?: string[],
  alias?: string
): ImportBlock {
  return { kind: "import", moduleName, source, selective, alias };
}

// Helper: Create open block (Phase 5 Week 3)
export function makeOpenBlock(moduleName: string, source?: string): OpenBlock {
  return { kind: "open", moduleName, source };
}

// Helper: Create async function (Phase 7)
export function makeAsyncFunction(
  name: string,
  params: Array<{ name: string; type?: TypeAnnotation }>,
  body: ASTNode
): AsyncFunction {
  return { kind: "async-function", name, params, body };
}

// Helper: Create await expression (Phase 7)
export function makeAwaitExpression(argument: ASTNode): AwaitExpression {
  return { kind: "await", argument };
}

// Helper: Create try block (Phase 11)
export function makeTryBlock(
  body: ASTNode,
  catchClauses?: CatchClause[],
  finallyBlock?: ASTNode
): TryBlock {
  return { kind: "try-block", body, catchClauses, finallyBlock };
}

// Helper: Create catch clause (Phase 11)
export function makeCatchClause(
  handler: ASTNode,
  pattern?: Pattern,
  variable?: string
): CatchClause {
  return { kind: "catch-clause", pattern, variable, handler };
}

// Helper: Create throw expression (Phase 11)
export function makeThrowExpression(argument: ASTNode): ThrowExpression {
  return { kind: "throw", argument };
}

// Helper: Create reasoning block (Phase 9c)
export function makeReasoningBlock(
  stage: "observe" | "analyze" | "decide" | "act" | "verify",
  data: Map<string, any>,
  observations?: any[],
  analysis?: any[],
  decisions?: any[],
  actions?: any[],
  verifications?: any[],
  transitions?: ReasoningTransition[],
  metadata?: { startTime?: string; endTime?: string; confidence?: number; feedback?: string }
): ReasoningBlock {
  return {
    kind: "reasoning-block",
    stage,
    data,
    observations,
    analysis,
    decisions,
    actions,
    verifications,
    transitions,
    metadata
  };
}

// Helper: Create reasoning transition (Phase 9c)
export function makeReasoningTransition(
  from: string,
  to: string,
  condition?: ASTNode,
  action?: ASTNode
): ReasoningTransition {
  return { from, to, condition, action };
}

// Helper: Create reasoning sequence (Phase 9c Extension)
export function makeReasoningSequence(
  stages: ReasoningBlock[],
  metadata?: {
    startTime?: string;
    endTime?: string;
    totalConfidence?: number;
    executionPath?: string[];
  }
): ReasoningSequence {
  return { kind: "reasoning-sequence", stages, metadata };
}

// ============================================================
// Phase 6: Type Guard Functions (타입 안전성 강화)
// ============================================================

// Block 타입 가드
export function isBlock(node: any): node is Block {
  return node && node.kind === "block";
}

// Literal 타입 가드
export function isLiteral(node: any): node is Literal {
  return node && node.kind === "literal";
}

// Symbol 리터럴 가드
export function isSymbolLiteral(node: any): node is Literal {
  return isLiteral(node) && node.type === "symbol";
}

// 배열 블록 가드 (특수: [Array ...] 형식)
export function isArrayBlock(node: any): node is Block {
  return isBlock(node) && node.type === "Array";
}

// FUNC 블록 가드
export function isFuncBlock(node: any): node is Block {
  return isBlock(node) && node.type === "FUNC";
}

// Variable 타입 가드
export function isVariable(node: any): node is Variable {
  return node && node.kind === "variable";
}

// SExpr 타입 가드
export function isSExpr(node: any): node is SExpr {
  return node && node.kind === "sexpr";
}

// ModuleBlock 타입 가드
export function isModuleBlock(node: any): node is ModuleBlock {
  return node && node.kind === "module";
}

// ImportBlock 타입 가드
export function isImportBlock(node: any): node is ImportBlock {
  return node && node.kind === "import";
}

// OpenBlock 타입 가드
export function isOpenBlock(node: any): node is OpenBlock {
  return node && node.kind === "open";
}

// SearchBlock 타입 가드 (NEW for Phase 9a)
export function isSearchBlock(node: any): node is SearchBlock {
  return node && node.kind === "search-block";
}

// LearnBlock 타입 가드 (NEW for Phase 9b)
export function isLearnBlock(node: any): node is LearnBlock {
  return node && node.kind === "learn-block";
}

// ReasoningBlock 타입 가드 (NEW for Phase 9c)
export function isReasoningBlock(node: any): node is ReasoningBlock {
  return node && node.kind === "reasoning-block";
}

// ReasoningSequence 타입 가드 (NEW for Phase 9c Extension)
export function isReasoningSequence(node: any): node is ReasoningSequence {
  return node && node.kind === "reasoning-sequence";
}

// TryBlock 타입 가드 (NEW for Phase 11)
export function isTryBlock(node: any): node is TryBlock {
  return node && node.kind === "try-block";
}

// CatchClause 타입 가드 (NEW for Phase 11)
export function isCatchClause(node: any): node is CatchClause {
  return node && node.kind === "catch-clause";
}

// ThrowExpression 타입 가드 (NEW for Phase 11)
export function isThrowExpression(node: any): node is ThrowExpression {
  return node && node.kind === "throw";
}
