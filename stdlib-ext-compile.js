var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/ext-compile.ts
var ext_compile_exports = {};
__export(ext_compile_exports, {
  createCompileModule: () => createCompileModule
});
module.exports = __toCommonJS(ext_compile_exports);

// src/stdlib-compile.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/lexer.ts
var KEYWORDS = /* @__PURE__ */ new Map([
  ["MODULE", "Module" /* Module */],
  ["TYPECLASS", "TypeClass" /* TypeClass */],
  ["INSTANCE", "Instance" /* Instance */],
  // import는 일반 함수로 처리 (파서 등록 불필요)
  ["open", "Open" /* Open */],
  // Phase 9a: Search functionality keywords
  ["search", "Search" /* Search */],
  ["fetch", "Fetch" /* Fetch */],
  // Phase 9b: Learning functionality keywords
  ["learn", "Learn" /* Learn */],
  ["recall", "Recall" /* Recall */],
  ["remember", "Remember" /* Remember */],
  ["forget", "Forget" /* Forget */],
  // Phase 9c: Reasoning functionality keywords
  ["observe", "Observe" /* Observe */],
  ["analyze", "Analyze" /* Analyze */],
  ["decide", "Decide" /* Decide */],
  ["act", "Act" /* Act */],
  ["verify", "Verify" /* Verify */],
  // Phase 9c: Conditional branching keywords
  ["if", "If" /* If */],
  ["when", "When" /* When */],
  ["then", "Then" /* Then */],
  ["else", "Else" /* Else */],
  // Phase 9c: Loop control keywords
  ["repeat", "Repeat" /* Repeat */],
  ["until", "Until" /* Until */],
  ["while", "While" /* While */],
  // Phase 11: Web DSL keywords
  ["PAGE", "Page" /* Page */],
  ["API", "Api" /* Api */],
  ["ROUTE", "Route" /* Route */],
  ["COMPONENT", "Component" /* Component */],
  ["FORM", "Form" /* Form */],
  ["STATE", "State" /* State */],
  ["COMPUTED", "Computed" /* Computed */],
  ["WATCH", "Watch" /* Watch */],
  ["METHOD", "Method" /* Method */],
  ["RENDER", "Render" /* Render */],
  ["HANDLER", "Handler" /* Handler */],
  ["VALIDATION", "Validation" /* Validation */],
  ["LAYOUT", "Layout" /* Layout */],
  ["MIDDLEWARE", "Middleware" /* Middleware */],
  ["SUSPENSE", "Suspense" /* Suspense */],
  ["SLOT", "Slot" /* Slot */],
  ["METADATA", "Metadata" /* Metadata */],
  // Phase 11: Enterprise backend keywords
  ["SERVICE", "Service" /* Service */],
  ["CONTROLLER", "Controller" /* Controller */],
  ["GUARD", "Guard" /* Guard */],
  ["PIPE", "Pipe" /* Pipe */],
  // Phase 11: Database ORM keywords
  ["MODEL", "Model" /* Model */],
  ["QUERY", "Query" /* Query */],
  ["MIGRATION", "Migration" /* Migration */],
  ["REPOSITORY", "Repository" /* Repository */],
  ["DATABASE", "Database" /* Database */],
  // Phase 11: Cache & Messaging keywords
  ["CACHE", "Cache" /* Cache */],
  ["CACHED", "Cached" /* Cached */],
  ["KAFKA", "Kafka" /* Kafka */],
  ["PRODUCER", "Producer" /* Producer */],
  ["CONSUMER", "Consumer" /* Consumer */],
  ["QUEUE", "Queue" /* Queue */],
  ["RABBITMQ", "RabbitMQ" /* RabbitMQ */],
  // Phase 11: Authentication keywords
  ["JWT", "JWT" /* JWT */],
  ["OAUTH", "OAuth" /* OAuth */],
  // Phase 11: Deployment keywords
  ["DOCKERFILE", "Dockerfile" /* Dockerfile */],
  ["DOCKER-COMPOSE", "DockerCompose" /* DockerCompose */],
  ["K8S-DEPLOYMENT", "K8sDeployment" /* K8sDeployment */],
  ["K8S-SERVICE", "K8sService" /* K8sService */],
  ["K8S-INGRESS", "K8sIngress" /* K8sIngress */],
  // Phase 11: Cloud keywords
  ["AWS", "AWS" /* AWS */],
  ["AWS-S3", "AwsS3" /* AwsS3 */],
  ["AWS-LAMBDA", "AwsLambda" /* AwsLambda */],
  ["AWS-RDS", "AwsRds" /* AwsRds */],
  ["AWS-SQS", "AwsSqs" /* AwsSqs */],
  ["GCP", "GCP" /* GCP */],
  ["GCP-CLOUD-RUN", "GcpCloudRun" /* GcpCloudRun */],
  ["GCP-BIGQUERY", "GcpBigquery" /* GcpBigquery */],
  ["AZURE", "Azure" /* Azure */],
  ["AZURE-FUNCTION", "AzureFunction" /* AzureFunction */],
  ["AZURE-COSMOS", "AzureCosmos" /* AzureCosmos */]
  // Note: browse, cache are treated as regular symbols, not keywords
]);
function getKeywordTokenType(text) {
  return KEYWORDS.get(text) ?? null;
}
function lex(source) {
  const tokens = [];
  let i = 0, line = 1, col = 1;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      if (ch === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
      continue;
    }
    if (ch === ";") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
      const startCol = col;
      i += 3;
      col += 3;
      let value = "";
      while (i < source.length) {
        if (source[i] === '"' && source[i + 1] === '"' && source[i + 2] === '"') {
          i += 3;
          col += 3;
          break;
        }
        if (source[i] === "\n") {
          line++;
          col = 1;
        } else {
          col++;
        }
        value += source[i];
        i++;
      }
      tokens.push({ type: "String" /* String */, value, line, col: startCol });
      continue;
    }
    if (ch === '"') {
      const start = i;
      const startCol = col;
      i++;
      col++;
      let value = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\" && i + 1 < source.length) {
          i++;
          col++;
          const esc = source[i];
          switch (esc) {
            case "n":
              value += "\n";
              break;
            case "t":
              value += "	";
              break;
            case "r":
              value += "\r";
              break;
            case "\\":
              value += "\\";
              break;
            case '"':
              value += '"';
              break;
            case "x": {
              const hex = source.slice(i + 1, i + 3);
              if (/^[0-9a-fA-F]{2}$/.test(hex)) {
                value += String.fromCharCode(parseInt(hex, 16));
                i += 2;
                col += 2;
              } else {
                value += "x";
              }
              break;
            }
            default:
              value += esc;
          }
          i++;
          col++;
        } else {
          if (source[i] === "\n") {
            line++;
            col = 1;
          } else {
            col++;
          }
          value += source[i];
          i++;
        }
      }
      if (i >= source.length) {
        throw new Error(`Unterminated string at line ${line}, col ${startCol}`);
      }
      i++;
      col++;
      tokens.push({ type: "String" /* String */, value, line, col: startCol });
      continue;
    }
    if (ch === "[") {
      tokens.push({ type: "LBracket" /* LBracket */, value: "[", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "RBracket" /* RBracket */, value: "]", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LParen" /* LParen */, value: "(", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RParen" /* RParen */, value: ")", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "{") {
      tokens.push({ type: "LBrace" /* LBrace */, value: "{", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "RBrace" /* RBrace */, value: "}", line, col });
      i++;
      col++;
      continue;
    }
    if (ch === "|") {
      const startCol = col;
      if (i + 1 < source.length && source[i + 1] === ">") {
        tokens.push({ type: "Symbol" /* Symbol */, value: "|>", line, col: startCol });
        i += 2;
        col += 2;
      } else {
        tokens.push({ type: "Symbol" /* Symbol */, value: "|", line, col: startCol });
        i++;
        col++;
      }
      continue;
    }
    if (ch === ":") {
      const startCol = col;
      tokens.push({ type: "Colon" /* Colon */, value: ":", line, col: startCol });
      i++;
      col++;
      continue;
    }
    if (ch === "^") {
      const startCol = col;
      i++;
      col++;
      let hint = "";
      while (i < source.length && /[a-zA-Z0-9_\-?]/.test(source[i])) {
        hint += source[i];
        i++;
        col++;
      }
      tokens.push({ type: "Symbol" /* Symbol */, value: "^" + hint, line, col: startCol });
      continue;
    }
    if (ch === "@") {
      const startCol = col;
      i++;
      col++;
      let varname = "";
      while (i < source.length && /[a-zA-Z0-9_\-?!]/.test(source[i])) {
        varname += source[i];
        i++;
        col++;
      }
      if (varname.length === 0) throw new Error(`Expected atom name after @ at line ${line}, col ${startCol}`);
      tokens.push({ type: "LParen" /* LParen */, value: "(", line, col: startCol });
      tokens.push({ type: "Symbol" /* Symbol */, value: "deref", line, col: startCol });
      tokens.push({ type: "Symbol" /* Symbol */, value: varname, line, col: startCol });
      tokens.push({ type: "RParen" /* RParen */, value: ")", line, col: startCol });
      continue;
    }
    if (ch === "$") {
      const start = i;
      const startCol = col;
      i++;
      col++;
      let varname = "";
      while (i < source.length && /[a-zA-Z0-9_\-?]/.test(source[i])) {
        varname += source[i];
        i++;
        col++;
      }
      if (varname.length === 0) {
        throw new Error(`Expected variable name after $ at line ${line}, col ${startCol}`);
      }
      tokens.push({ type: "Variable" /* Variable */, value: varname, line, col: startCol });
      continue;
    }
    if (/\d/.test(ch) || ch === "-" && i + 1 < source.length && /\d/.test(source[i + 1])) {
      const start = i;
      const startCol = col;
      if (ch === "-") {
        i++;
        col++;
      }
      while (i < source.length && /[\d.]/.test(source[i])) {
        i++;
        col++;
      }
      const value = source.slice(start, i);
      tokens.push({ type: "Number" /* Number */, value, line, col: startCol });
      continue;
    }
    if (/[a-zA-Z_<>=!+\-*&/%?]/.test(ch)) {
      const start = i;
      const startCol = col;
      while (i < source.length && /[a-zA-Z0-9_<>=!+\-*/?&.%]/.test(source[i])) {
        i++;
        col++;
      }
      const value = source.slice(start, i);
      const keywordType = getKeywordTokenType(value);
      const tokenType = keywordType ?? "Symbol" /* Symbol */;
      tokens.push({ type: tokenType, value, line, col: startCol });
      continue;
    }
    throw new Error(`Unexpected character '${ch}' at line ${line}, col ${col}`);
  }
  tokens.push({ type: "EOF" /* EOF */, value: "", line, col });
  return tokens;
}

// src/ast.ts
function makeLiteral(type, value, line) {
  return { kind: "literal", type, value, line };
}
function makeTemplateString(value, line) {
  return { kind: "template-string", value, line };
}
function makeVariable(name, line) {
  return { kind: "variable", name, line };
}
function makeSExpr(op, args, line) {
  return { kind: "sexpr", op, args, line };
}
function makeKeyword(name) {
  return { kind: "keyword", name };
}
function makeBlock(type, name, fields, line) {
  return { kind: "block", type, name, fields, line };
}
function makeTypeAnnotation(name, generic, union, optional) {
  return { kind: "type", name, generic, union, optional };
}
function makeLiteralPattern(type, value) {
  return { kind: "literal-pattern", type, value };
}
function makeVariablePattern(name) {
  return { kind: "variable-pattern", name };
}
function makeWildcardPattern() {
  return { kind: "wildcard-pattern" };
}
function makeListPattern(elements, restElement) {
  return { kind: "list-pattern", elements, restElement };
}
function makeStructPattern(fields, asBinding) {
  return { kind: "struct-pattern", fields, asBinding };
}
function makeRangePattern(min, max) {
  return { kind: "range-pattern", min, max };
}
function makeOrPattern(alternatives) {
  return { kind: "or-pattern", alternatives };
}
function makeMatchCase(pattern, body, guard) {
  return { pattern, guard, body };
}
function makePatternMatch(value, cases, defaultCase) {
  return { kind: "pattern-match", value, cases, defaultCase };
}
function makeImportBlock(moduleName, source, selective, alias) {
  return { kind: "import", moduleName, source, selective, alias };
}
function makeOpenBlock(moduleName, source) {
  return { kind: "open", moduleName, source };
}
function makeTryBlock(body, catchClauses, finallyBlock) {
  return { kind: "try-block", body, catchClauses, finallyBlock };
}
function makeCatchClause(handler, pattern, variable) {
  return { kind: "catch-clause", pattern, variable, handler };
}
function makeThrowExpression(argument) {
  return { kind: "throw", argument };
}
function makePageNode(name, title, route, component, metadata, line) {
  return { kind: "page", name, title, route, component, metadata, line };
}
function makeRouteNode(name, path2, method, handler, middleware, validation, line) {
  return { kind: "route", name, path: path2, method, handler, middleware, validation, line };
}
function makeComponentNode(name, render, state, computed, watch, methods, slots, line) {
  return { kind: "component", name, render, state, computed, watch, methods, slots, line };
}
function makeFormNode(name, fields, validation, submit, handlers, line) {
  return { kind: "form", name, fields, validation, submit, handlers, line };
}

// src/parser.ts
var ParserError = class extends Error {
  constructor(message, line, col, hint, code, stage = "parse") {
    const codeStr = code ? `[${code}]` : "";
    const loc = `[${line}:${col}]`;
    const hintLine = hint ? `
  \uD78C\uD2B8: ${hint}` : "";
    super(`${codeStr} ${loc} ${message}${hintLine}`);
    this.line = line;
    this.col = col;
    this.hint = hint;
    this.code = code;
    this.stage = stage;
  }
  toJSON() {
    return {
      code: this.code || "E_PARSE_SYNTAX_ERROR",
      stage: this.stage,
      message: this.message,
      file: void 0,
      line: this.line,
      column: this.col,
      symbol: void 0,
      cause: void 0,
      hint: this.hint
    };
  }
};
var ERROR_HINTS = {
  "Expected RParen, got Symbol": "\uAD04\uD638\uAC00 \uB2EB\uD788\uC9C0 \uC54A\uC558\uAC70\uB098 \uC640\uC77C\uB4DC\uCE74\uB4DC \uD328\uD134\uC5D0 \uAD04\uD638\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4: _ expr \u2192 (_ expr)",
  "Expected RParen, got EOF": "\uAD04\uD638\uAC00 \uB2EB\uD788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uC5EC\uB294 ( \uC640 \uB2EB\uB294 ) \uC218\uB97C \uD655\uC778\uD558\uC138\uC694.",
  "Expected operator": "S-expression\uC758 \uCCAB \uC694\uC18C\uB294 \uD568\uC218\uBA85\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4: (\uD568\uC218\uBA85 \uC778\uC790...)",
  "Expected ':' keyword in map literal": "\uB9F5 \uB9AC\uD130\uB7F4\uC758 \uD0A4\uB294 :\uC73C\uB85C \uC2DC\uC791\uD574\uC57C \uD569\uB2C8\uB2E4: {:key value}",
  "Unexpected token: Colon": "\uCF5C\uB860 \uD0A4\uC6CC\uB4DC (:key)\uB294 \uB9F5 \uB9AC\uD130\uB7F4 \uB610\uB294 \uBE14\uB85D \uD544\uB4DC\uC5D0\uC11C\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
  "Expected block type": "\uBE14\uB85D\uC740 [FUNC name :params [...] :body ...] \uD615\uC2DD\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.",
  "Unterminated string": '\uBB38\uC790\uC5F4\uC774 \uB2EB\uD788\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2EB\uB294 " \uB97C \uCD94\uAC00\uD558\uC138\uC694.'
};
var Parser = class {
  constructor(tokens) {
    this.pos = 0;
    // 자잘 #4 (2026-04-25): paren matching info — opening LParen 위치 추적
    this.parenStack = [];
    this.tokens = tokens;
  }
  parse() {
    const nodes = [];
    while (!this.isAtEnd()) {
      if (this.check("EOF" /* EOF */)) break;
      if (this.check("LBracket" /* LBracket */)) {
        const nextIdx = this.pos + 1;
        const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE", "SERVER", "ROUTE", "MIDDLEWARE", "WEBSOCKET", "ERROR-HANDLER", "PAGE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD", "MODEL", "QUERY", "MIGRATION", "REPOSITORY", "DATABASE", "CACHE", "CACHED", "KAFKA", "PRODUCER", "CONSUMER", "QUEUE", "RABBITMQ", "JWT", "OAUTH", "DOCKERFILE", "DOCKER-COMPOSE", "K8S-DEPLOYMENT", "K8S-SERVICE", "K8S-INGRESS", "AWS", "AWS-S3", "AWS-LAMBDA", "AWS-RDS", "AWS-SQS", "GCP", "GCP-CLOUD-RUN", "GCP-BIGQUERY", "AZURE", "AZURE-FUNCTION", "AZURE-COSMOS"];
        if (nextIdx < this.tokens.length) {
          const nextToken = this.tokens[nextIdx];
          const isBlockKeyword = nextToken.type === "Module" /* Module */ || nextToken.type === "TypeClass" /* TypeClass */ || nextToken.type === "Instance" /* Instance */ || nextToken.type === "Page" /* Page */ || nextToken.type === "Api" /* Api */ || nextToken.type === "Component" /* Component */ || nextToken.type === "Form" /* Form */ || nextToken.type === "Route" /* Route */ || nextToken.type === "Service" /* Service */ || nextToken.type === "Controller" /* Controller */ || nextToken.type === "Guard" /* Guard */ || nextToken.type === "Model" /* Model */ || nextToken.type === "Query" /* Query */ || nextToken.type === "Migration" /* Migration */ || nextToken.type === "Repository" /* Repository */ || nextToken.type === "Database" /* Database */ || nextToken.type === "Cached" /* Cached */ || nextToken.type === "Kafka" /* Kafka */ || nextToken.type === "JWT" /* JWT */ || nextToken.type === "OAuth" /* OAuth */ || nextToken.type === "Dockerfile" /* Dockerfile */ || nextToken.type === "K8sDeployment" /* K8sDeployment */ || nextToken.type === "AWS" /* AWS */ || nextToken.type === "GCP" /* GCP */ || nextToken.type === "Azure" /* Azure */;
          const isKnownBlockType = nextToken.type === "Symbol" /* Symbol */ && knownBlockTypes.includes(nextToken.value);
          const hasKeywordAfter = nextIdx + 1 < this.tokens.length && (this.tokens[nextIdx + 1].type === "Keyword" /* Keyword */ || this.tokens[nextIdx + 1].type === "Colon" /* Colon */);
          if (isBlockKeyword || isKnownBlockType || hasKeywordAfter) {
            nodes.push(this.parseBlock());
          } else {
            nodes.push(this.parseArray());
          }
        } else {
          nodes.push(this.parseBlock());
        }
      } else if (this.check("LParen" /* LParen */)) {
        nodes.push(this.parseSExpr());
      } else {
        throw this.error(
          `Expected block or S-expression, got ${this.peek().type}`,
          this.peek()
        );
      }
    }
    return nodes;
  }
  // [BLOCK_TYPE name :key1 val1 :key2 val2 ...]
  // Phase 6: BLOCK_TYPE can be Symbol (old) or keyword token (MODULE, TYPECLASS, INSTANCE)
  parseBlock() {
    const lbracket = this.expect("LBracket" /* LBracket */);
    const blockLine = lbracket.line;
    const typeToken = this.advance();
    let blockType;
    if (typeToken.type === "Symbol" /* Symbol */) {
      blockType = typeToken.value;
      if (blockType === "FUNC" && !process.env.FL_NO_DEPRECATION_WARN) {
        process.stderr.write(`\x1B[33m[deprecated]\x1B[0m [FUNC ...] \uBB38\uBC95\uC740 deprecated\uC785\uB2C8\uB2E4. (defn ...) \uC744 \uC0AC\uC6A9\uD558\uC138\uC694. (line ${typeToken.line})
`);
      }
    } else if (typeToken.type === "Module" /* Module */) {
      blockType = "MODULE";
    } else if (typeToken.type === "TypeClass" /* TypeClass */) {
      blockType = "TYPECLASS";
    } else if (typeToken.type === "Instance" /* Instance */) {
      blockType = "INSTANCE";
    } else if (typeToken.type === "Page" /* Page */) {
      blockType = "PAGE";
    } else if (typeToken.type === "Api" /* Api */) {
      blockType = "API";
    } else if (typeToken.type === "Route" /* Route */) {
      blockType = "ROUTE";
    } else if (typeToken.type === "Component" /* Component */) {
      blockType = "COMPONENT";
    } else if (typeToken.type === "Form" /* Form */) {
      blockType = "FORM";
    } else if (typeToken.type === "Service" /* Service */) {
      blockType = "SERVICE";
    } else if (typeToken.type === "Controller" /* Controller */) {
      blockType = "CONTROLLER";
    } else if (typeToken.type === "Guard" /* Guard */) {
      blockType = "GUARD";
    } else if (typeToken.type === "Model" /* Model */) {
      blockType = "MODEL";
    } else {
      throw this.error(`Expected block type (symbol or keyword), got ${typeToken.type}`, typeToken);
    }
    let blockName;
    if (blockType === "FUNC" && (this.check("Colon" /* Colon */) || this.check("Keyword" /* Keyword */))) {
      blockName = `__anon_func_${this.pos}`;
    } else {
      const nameToken = this.advance();
      if (nameToken.type !== "Symbol" /* Symbol */) {
        throw this.error(`Expected block name (symbol), got ${nameToken.type}`, nameToken);
      }
      blockName = nameToken.value;
    }
    const fields = /* @__PURE__ */ new Map();
    const typeAnnotations = /* @__PURE__ */ new Map();
    let generics;
    while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
      let keyName;
      const startToken = this.peek();
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }
        const keyToken = this.advance();
        keyName = keyToken.value;
      } else if (this.check("Keyword" /* Keyword */)) {
        const keyToken = this.advance();
        keyName = keyToken.value;
        if (keyName.startsWith(":")) {
          keyName = keyName.substring(1);
        }
      } else {
        throw this.error(
          `Expected keyword field (starting with :), got ${this.peek().type}`,
          this.peek()
        );
      }
      const values = [];
      if (!this.check("Keyword" /* Keyword */) && !this.check("Colon" /* Colon */) && !this.check("RBracket" /* RBracket */)) {
        values.push(this.parseValue());
      }
      while (!this.check("Keyword" /* Keyword */) && !this.check("Colon" /* Colon */) && !this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
        values.push(this.parseValue());
      }
      if (values.length === 0) {
        throw this.error(`Expected at least one value for keyword ${keyName}`, startToken);
      } else if (values.length === 1) {
        fields.set(keyName, values[0]);
      } else {
        fields.set(keyName, values);
      }
      if (keyName === "return" && values.length === 1) {
        const returnValue = values[0];
        if (returnValue.kind === "literal" && returnValue.type === "symbol") {
          const typeName = returnValue.value;
          typeAnnotations.set("return", makeTypeAnnotation(typeName));
        }
      }
      if (keyName === "generics" && values.length === 1) {
        const genericsValue = values[0];
        if (genericsValue.kind === "block" && genericsValue.type === "Array") {
          const arrayItems = genericsValue.fields?.get("items");
          if (Array.isArray(arrayItems)) {
            const gen = [];
            for (const item of arrayItems) {
              if (item.kind === "literal" && item.type === "symbol") {
                gen.push(item.value);
              }
            }
            if (gen.length > 0) {
              generics = gen;
            }
          }
        }
      }
      if (keyName === "params" && values.length === 1) {
        const paramsValue = values[0];
        if (paramsValue.kind === "literal" && paramsValue.type === "symbol") {
        } else if (paramsValue.kind === "block" && paramsValue.type === "Array") {
          const arrayItems = paramsValue.fields?.get("items");
          if (Array.isArray(arrayItems)) {
            const paramTypes = [];
            for (const item of arrayItems) {
              if (item.kind === "block" && item.type === "Array") {
                const pairItems = item.fields?.get("items");
                if (Array.isArray(pairItems) && pairItems.length === 2) {
                  const typeNode = pairItems[1];
                  if (typeNode.kind === "literal" && typeNode.type === "symbol") {
                    const typeName = typeNode.value;
                    paramTypes.push(makeTypeAnnotation(typeName));
                  }
                }
              }
            }
            if (paramTypes.length > 0) {
              typeAnnotations.set("params", paramTypes);
            }
          }
        }
      }
    }
    this.expect("RBracket" /* RBracket */);
    if (blockType === "MODULE") {
      const block2 = makeBlock(blockType, blockName, fields, blockLine);
      return this.convertBlockToModuleBlock(block2);
    }
    if (blockType === "TYPECLASS") {
      const block2 = makeBlock(blockType, blockName, fields, blockLine);
      return this.convertBlockToTypeClass(block2);
    }
    if (blockType === "INSTANCE") {
      const block2 = makeBlock(blockType, blockName, fields, blockLine);
      return this.convertBlockToInstance(block2);
    }
    const enterpriseBlocks = ["PAGE", "ROUTE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD", "MODEL", "QUERY", "MIGRATION", "REPOSITORY", "DATABASE", "CACHE", "CACHED", "KAFKA", "PRODUCER", "CONSUMER", "QUEUE", "RABBITMQ", "JWT", "OAUTH", "DOCKERFILE", "DOCKER-COMPOSE", "K8S-DEPLOYMENT", "K8S-SERVICE", "K8S-INGRESS", "AWS", "AWS-S3", "AWS-LAMBDA", "AWS-RDS", "AWS-SQS", "GCP", "GCP-CLOUD-RUN", "GCP-BIGQUERY", "AZURE", "AZURE-FUNCTION", "AZURE-COSMOS"];
    if (enterpriseBlocks.includes(blockType)) {
      const block2 = makeBlock(blockType, blockName, fields, blockLine);
      return block2;
    }
    const block = makeBlock(blockType, blockName, fields, blockLine);
    if (blockType === "FUNC" || typeAnnotations.size > 0) {
      block.typeAnnotations = typeAnnotations;
    }
    if (generics && generics.length > 0) {
      block.generics = generics;
    }
    return block;
  }
  // Phase 6: Convert Block to ModuleBlock
  convertBlockToModuleBlock(block) {
    const exports2 = [];
    const bodyNodes = [];
    const exportsField = block.fields?.get("exports");
    if (exportsField) {
      if (exportsField.kind === "block" && exportsField.type === "Array") {
        const items = exportsField.fields?.get("items");
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if (item.kind === "literal" && item.type === "symbol") {
              exports2.push(item.value);
            }
          });
        }
      } else if (exportsField.kind === "literal" && exportsField.type === "symbol") {
        exports2.push(exportsField.value);
      }
    }
    const bodyField = block.fields?.get("body");
    if (bodyField) {
      if (bodyField.kind === "block" && bodyField.type === "Array") {
        const items = bodyField.fields?.get("items");
        if (Array.isArray(items)) {
          bodyNodes.push(...items);
        }
      } else if (Array.isArray(bodyField)) {
        bodyNodes.push(...bodyField);
      } else {
        bodyNodes.push(bodyField);
      }
    }
    return {
      kind: "module",
      name: block.name,
      exports: exports2,
      body: bodyNodes,
      path: void 0
    };
  }
  // Phase 5: Convert Block to TypeClass
  convertBlockToTypeClass(block) {
    const methods = /* @__PURE__ */ new Map();
    let typeParams = [];
    const typeParamsField = block.fields?.get("typeParams");
    if (typeParamsField) {
      if (typeParamsField.kind === "block" && typeParamsField.type === "Array") {
        const items = typeParamsField.fields?.get("items");
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if (item.kind === "literal" && item.type === "symbol") {
              typeParams.push(item.value);
            }
          });
        }
      } else if (typeParamsField.kind === "literal" && typeParamsField.type === "symbol") {
        typeParams.push(typeParamsField.value);
      } else if (Array.isArray(typeParamsField)) {
        typeParamsField.forEach((param) => {
          if (param.kind === "literal" && param.type === "symbol") {
            typeParams.push(param.value);
          }
        });
      }
    }
    const methodsField = block.fields?.get("methods");
    if (methodsField) {
      if (methodsField.kind === "block" && methodsField.type === "Array") {
        const items = methodsField.fields?.get("items");
        if (Array.isArray(items)) {
          items.forEach((item) => {
            if (item.kind === "block" && item.type === "Array") {
              const subItems = item.fields?.get("items");
              if (Array.isArray(subItems) && subItems.length === 2) {
                const nameNode = subItems[0];
                const typeNode = subItems[1];
                if (nameNode.kind === "literal" && nameNode.type === "symbol") {
                  const methodName = nameNode.value;
                  methods.set(methodName, {
                    name: methodName,
                    type: typeNode
                  });
                }
              }
            }
          });
        }
      }
    }
    return {
      kind: "type-class",
      name: block.name,
      typeParams,
      methods
    };
  }
  // Phase 5: Convert Block to TypeClassInstance
  convertBlockToInstance(block) {
    let className = "";
    const concreteType = block.name;
    const implementations = /* @__PURE__ */ new Map();
    const typeClassField = block.fields?.get("typeclass");
    if (typeClassField) {
      if (typeClassField.kind === "literal" && typeClassField.type === "symbol") {
        className = typeClassField.value;
      }
    }
    block.fields?.forEach((value, key) => {
      if (key !== "typeclass") {
        implementations.set(key, value);
      }
    });
    return {
      kind: "type-class-instance",
      className,
      concreteType,
      implementations
    };
  }
  // Parse any value: literal, variable, block, S-expr, pattern-match, or array
  parseValue() {
    if (this.check("LParen" /* LParen */)) {
      return this.parseSExpr();
    }
    if (this.check("Number" /* Number */)) {
      const token = this.advance();
      return makeLiteral("number", parseFloat(token.value));
    }
    if (this.check("String" /* String */)) {
      const token = this.advance();
      if (token.value.includes("${")) {
        return makeTemplateString(token.value);
      }
      return makeLiteral("string", token.value);
    }
    if (this.check("Variable" /* Variable */)) {
      const token = this.advance();
      return makeVariable(token.value, token.line);
    }
    if (this.check("Keyword" /* Keyword */)) {
      const token = this.advance();
      return makeKeyword(token.value);
    }
    if (this.check("Else" /* Else */) || this.check("Then" /* Then */) || this.check("When" /* When */) || this.check("Repeat" /* Repeat */) || this.check("Until" /* Until */) || this.check("While" /* While */)) {
      const token = this.advance();
      return makeLiteral("symbol", token.value);
    }
    if (this.check("Colon" /* Colon */)) {
      this.advance();
      const next = this.tokens[this.pos];
      if (next) {
        if (next.type === "Variable" /* Variable */ && next.value) {
          this.advance();
          return makeLiteral("string", "$" + next.value);
        }
        if (next.value && /^[a-zA-Z_][a-zA-Z0-9_\-]*$/.test(next.value)) {
          return makeLiteral("string", this.advance().value);
        }
      }
      return makeLiteral("string", ":");
    }
    if (this.check("LBrace" /* LBrace */)) {
      return this.parseMap();
    }
    if (this.check("LBracket" /* LBracket */)) {
      const nextIdx = this.pos + 1;
      const knownBlockTypes = ["FUNC", "INTENT", "PROMPT", "PIPE", "AGENT", "LOAD", "RULE", "MODULE", "TYPECLASS", "INSTANCE", "SERVER", "ROUTE", "MIDDLEWARE", "WEBSOCKET", "ERROR-HANDLER", "PAGE", "COMPONENT", "FORM", "SERVICE", "CONTROLLER", "GUARD"];
      if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === "Symbol" /* Symbol */) {
        const potentialType = this.tokens[nextIdx].value;
        const isKnownType = knownBlockTypes.includes(potentialType);
        const nextNextIdx = nextIdx + 1;
        const isAllCaps = /^[A-Z][A-Z0-9_\-]*$/.test(potentialType);
        const hasKeywordAfterName = isAllCaps && nextNextIdx < this.tokens.length && (this.tokens[nextNextIdx].type === "Keyword" /* Keyword */ || this.tokens[nextNextIdx].type === "Colon" /* Colon */);
        if (isKnownType || hasKeywordAfterName) {
          return this.parseBlock();
        } else {
          return this.parseArray();
        }
      } else if (nextIdx < this.tokens.length && this.tokens[nextIdx].type === "Module" /* Module */) {
        const result = this.parseBlock();
        if (result.kind === "module") {
          return result;
        }
        throw this.error(`Expected ModuleBlock from parseBlock with MODULE token`, this.peek());
      } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "TypeClass" /* TypeClass */ || this.tokens[nextIdx].type === "Instance" /* Instance */)) {
        return this.parseBlock();
      } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "Page" /* Page */ || this.tokens[nextIdx].type === "Api" /* Api */ || this.tokens[nextIdx].type === "Component" /* Component */ || this.tokens[nextIdx].type === "Form" /* Form */ || this.tokens[nextIdx].type === "Route" /* Route */)) {
        return this.parseBlock();
      } else if (nextIdx < this.tokens.length && (this.tokens[nextIdx].type === "Service" /* Service */ || this.tokens[nextIdx].type === "Controller" /* Controller */ || this.tokens[nextIdx].type === "Guard" /* Guard */ || this.tokens[nextIdx].type === "Model" /* Model */ || this.tokens[nextIdx].type === "Query" /* Query */ || this.tokens[nextIdx].type === "Migration" /* Migration */ || this.tokens[nextIdx].type === "Repository" /* Repository */ || this.tokens[nextIdx].type === "Database" /* Database */ || this.tokens[nextIdx].type === "Cached" /* Cached */ || this.tokens[nextIdx].type === "Kafka" /* Kafka */ || this.tokens[nextIdx].type === "Producer" /* Producer */ || this.tokens[nextIdx].type === "Consumer" /* Consumer */ || this.tokens[nextIdx].type === "Queue" /* Queue */ || this.tokens[nextIdx].type === "RabbitMQ" /* RabbitMQ */ || this.tokens[nextIdx].type === "JWT" /* JWT */ || this.tokens[nextIdx].type === "OAuth" /* OAuth */ || this.tokens[nextIdx].type === "Dockerfile" /* Dockerfile */ || this.tokens[nextIdx].type === "DockerCompose" /* DockerCompose */ || this.tokens[nextIdx].type === "K8sDeployment" /* K8sDeployment */ || this.tokens[nextIdx].type === "K8sService" /* K8sService */ || this.tokens[nextIdx].type === "K8sIngress" /* K8sIngress */ || this.tokens[nextIdx].type === "AWS" /* AWS */ || this.tokens[nextIdx].type === "GCP" /* GCP */ || this.tokens[nextIdx].type === "Azure" /* Azure */)) {
        return this.parseBlock();
      } else {
        return this.parseArray();
      }
    }
    if (this.check("Symbol" /* Symbol */)) {
      const token = this.advance();
      if (token.value === "true") {
        return makeLiteral("boolean", true);
      }
      if (token.value === "false") {
        return makeLiteral("boolean", false);
      }
      return makeLiteral("symbol", token.value);
    }
    throw this.error(`Unexpected token: ${this.peek().type}`, this.peek());
  }
  // Parse array: [val1 val2 val3 ...]
  parseArray() {
    this.expect("LBracket" /* LBracket */);
    const values = [];
    while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
      values.push(this.parseValue());
    }
    this.expect("RBracket" /* RBracket */);
    const arrayFields = /* @__PURE__ */ new Map();
    arrayFields.set("items", values);
    return makeBlock("Array", "$array", arrayFields);
  }
  // Parse map literal: {:key1 value1 :key2 value2 ...} or {"key1" value1 "key2" value2 ...}
  parseMap() {
    this.expect("LBrace" /* LBrace */);
    const mapFields = /* @__PURE__ */ new Map();
    while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
      let key;
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        const keyTok = this.peek();
        if (keyTok.type === "RBrace" /* RBrace */ || this.isAtEnd()) {
          throw this.error(`Expected key after ':' in map literal`, keyTok);
        }
        if (keyTok.type === "Variable" /* Variable */) {
          this.advance();
          key = "$" + keyTok.value;
        } else {
          key = this.advance().value;
        }
      } else if (this.check("String" /* String */)) {
        key = this.advance().value;
      } else {
        throw this.error(`Map key must be :keyword or "string"`, this.peek());
      }
      const value = this.parseValue();
      mapFields.set(key, value);
    }
    this.expect("RBrace" /* RBrace */);
    return makeBlock("Map", "$map", mapFields);
  }
  // Check if next is an array literal (not generic function type args)
  // Array literal: [$x ...] or [1 2 3] or [value ...]
  // Generic syntax: [int string] (all symbols)
  isArrayLiteralStart() {
    if (!this.check("LBracket" /* LBracket */)) return false;
    const peekPos = this.pos + 1;
    if (peekPos >= this.tokens.length) return false;
    const nextToken = this.tokens[peekPos];
    if (nextToken.type === "Symbol" /* Symbol */) {
      const v = nextToken.value;
      const isGenericType = v.length <= 2 && v === v.toUpperCase() && /^[A-Z]/.test(v);
      return !isGenericType;
    }
    return nextToken.type === "Variable" /* Variable */ || nextToken.type === "Number" /* Number */ || nextToken.type === "String" /* String */ || nextToken.type === "RBracket" /* RBracket */ || nextToken.type === "LBracket" /* LBracket */ || nextToken.type === "LParen" /* LParen */ || nextToken.type === "LBrace" /* LBrace */ || nextToken.type === "Keyword" /* Keyword */ || nextToken.type === "Colon" /* Colon */;
  }
  // Parse S-expression: (op arg1 arg2 ...) or (op[T] arg1 arg2 ...) for generic functions
  // Also handles match expressions: (match value (pattern body) ...)
  // Phase 6: Also handles import and open expressions
  // Phase 9a: Also handles search and fetch expressions
  // Phase 9b: Also handles learn and recall expressions
  parseSExpr() {
    this.expect("LParen" /* LParen */);
    let op;
    const opToken = this.advance();
    if (opToken.type === "Open" /* Open */) {
      op = "open";
    } else if (opToken.type === "Search" /* Search */) {
      op = "search";
    } else if (opToken.type === "Fetch" /* Fetch */) {
      op = "fetch";
    } else if (opToken.type === "Learn" /* Learn */) {
      op = "learn";
    } else if (opToken.type === "Recall" /* Recall */) {
      op = "recall";
    } else if (opToken.type === "Remember" /* Remember */) {
      op = "remember";
    } else if (opToken.type === "Forget" /* Forget */) {
      op = "forget";
    } else if (opToken.type === "Observe" /* Observe */) {
      op = "observe";
    } else if (opToken.type === "Analyze" /* Analyze */) {
      op = "analyze";
    } else if (opToken.type === "Decide" /* Decide */) {
      op = "decide";
    } else if (opToken.type === "Act" /* Act */) {
      op = "act";
    } else if (opToken.type === "Verify" /* Verify */) {
      op = "verify";
    } else if (opToken.type === "If" /* If */) {
      op = "if";
    } else if (opToken.type === "When" /* When */) {
      op = "when";
    } else if (opToken.type === "Then" /* Then */) {
      op = "then";
    } else if (opToken.type === "Else" /* Else */) {
      op = "else";
    } else if (opToken.type === "Repeat" /* Repeat */) {
      op = "repeat";
    } else if (opToken.type === "Until" /* Until */) {
      op = "until";
    } else if (opToken.type === "While" /* While */) {
      op = "while";
    } else if (opToken.type === "LParen" /* LParen */) {
      this.pos--;
      const exprs = [];
      while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
        exprs.push(this.parseValue());
      }
      this.expect("RParen" /* RParen */);
      if (exprs.length === 1) return exprs[0];
      return { kind: "sexpr", op: "do", args: exprs };
    } else if (opToken.type === "Variable" /* Variable */) {
      op = opToken.value.startsWith("$") ? opToken.value : "$" + opToken.value;
    } else if (opToken.type !== "Symbol" /* Symbol */) {
      throw this.error(`Expected operator (symbol or keyword) in S-expression, got ${opToken.type}`, opToken);
    } else {
      op = opToken.value;
    }
    if (op === "import") {
      const importBlock = this.parseImportExpression();
      this.expect("RParen" /* RParen */);
      return importBlock;
    }
    if (op === "open") {
      const openBlock = this.parseOpenExpression();
      this.expect("RParen" /* RParen */);
      return openBlock;
    }
    if (op === "search") {
      const searchBlock = this.parseSearchExpression();
      this.expect("RParen" /* RParen */);
      return searchBlock;
    }
    if (op === "fetch") {
      const searchBlock = this.parseFetchExpression();
      this.expect("RParen" /* RParen */);
      return searchBlock;
    }
    if (op === "learn") {
      const learnBlock = this.parseLearnExpression();
      this.expect("RParen" /* RParen */);
      return learnBlock;
    }
    if (op === "recall") {
      const learnBlock = this.parseRecallExpression();
      this.expect("RParen" /* RParen */);
      return learnBlock;
    }
    if (op === "observe" || opToken.type === "Observe" /* Observe */) {
      const reasoningBlock = this.parseReasoningExpression("observe");
      this.expect("RParen" /* RParen */);
      return reasoningBlock;
    }
    if (op === "analyze" || opToken.type === "Analyze" /* Analyze */) {
      const reasoningBlock = this.parseReasoningExpression("analyze");
      this.expect("RParen" /* RParen */);
      return reasoningBlock;
    }
    if (op === "decide" || opToken.type === "Decide" /* Decide */) {
      const reasoningBlock = this.parseReasoningExpression("decide");
      this.expect("RParen" /* RParen */);
      return reasoningBlock;
    }
    if (op === "act" || opToken.type === "Act" /* Act */) {
      const reasoningBlock = this.parseReasoningExpression("act");
      this.expect("RParen" /* RParen */);
      return reasoningBlock;
    }
    if (op === "verify" || opToken.type === "Verify" /* Verify */) {
      const reasoningBlock = this.parseReasoningExpression("verify");
      this.expect("RParen" /* RParen */);
      return reasoningBlock;
    }
    if (op === "reasoning-sequence") {
      const reasoningSeq = this.parseReasoningSequenceExpression();
      this.expect("RParen" /* RParen */);
      return reasoningSeq;
    }
    if (op === "try") {
      const tryBlock = this.parseTryExpression();
      this.expect("RParen" /* RParen */);
      return tryBlock;
    }
    if (op === "throw") {
      const throwExpr = this.parseThrowExpression();
      this.expect("RParen" /* RParen */);
      return throwExpr;
    }
    if (op === "match") {
      const matchExpr = this.parsePatternMatch();
      this.expect("RParen" /* RParen */);
      return matchExpr;
    }
    const specialFormsForbiddingGeneric = /* @__PURE__ */ new Set([
      "fn",
      "let",
      "if",
      "cond",
      "match",
      "do",
      "try",
      "catch",
      "let*",
      "letrec",
      "define",
      "async",
      "await",
      "loop",
      "recur",
      "import",
      "export"
    ]);
    if (!specialFormsForbiddingGeneric.has(op) && this.check("LBracket" /* LBracket */) && !this.isArrayLiteralStart()) {
      this.advance();
      const typeArgs = [];
      while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
        const typeToken = this.advance();
        if (typeToken.type === "Symbol" /* Symbol */) {
          typeArgs.push(typeToken.value);
        }
        if (this.check("Symbol" /* Symbol */) && this.peek().value === ",") {
          this.advance();
        }
      }
      this.expect("RBracket" /* RBracket */);
      if (typeArgs.length > 0) {
        op = `${op}[${typeArgs.join(", ")}]`;
      }
    }
    const args = [];
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      args.push(this.parseValue());
    }
    this.expect("RParen" /* RParen */);
    return makeSExpr(op, args, opToken.line);
  }
  // Parse type annotation: int, string, bool, array<T>, map<K,V>, T?
  parseTypeAnnotation() {
    const token = this.advance();
    if (token.type !== "Symbol" /* Symbol */) {
      throw this.error(`Expected type annotation (symbol), got ${token.type}`, token);
    }
    let typeName = token.value;
    let generic = void 0;
    let optional = false;
    if (this.check("Symbol" /* Symbol */) && this.peek().value === "?") {
      this.advance();
      optional = true;
    }
    if (typeName.includes("<") && typeName.includes(">")) {
      const match = typeName.match(/<(.+)>/);
      if (match) {
        const innerTypeName = match[1];
        generic = makeTypeAnnotation(innerTypeName);
        typeName = typeName.substring(0, typeName.indexOf("<"));
      }
    }
    return makeTypeAnnotation(typeName, generic, void 0, optional);
  }
  // ===== Pattern Matching (Phase 4 Week 3-4) =====
  // Parse pattern: literal, variable, wildcard, list, struct, or or-pattern
  parsePattern() {
    const firstPattern = this.parseAtomicPattern();
    if (this.check("Symbol" /* Symbol */) && this.peek().value === "|") {
      const alternatives = [firstPattern];
      while (this.check("Symbol" /* Symbol */) && this.peek().value === "|") {
        this.advance();
        alternatives.push(this.parseAtomicPattern());
      }
      return makeOrPattern(alternatives);
    }
    return firstPattern;
  }
  // Parse atomic pattern (without or-alternatives)
  parseAtomicPattern() {
    if (this.check("Symbol" /* Symbol */) && this.peek().value === "_") {
      this.advance();
      return makeWildcardPattern();
    }
    if (this.check("Variable" /* Variable */)) {
      const varToken = this.advance();
      return makeVariablePattern(varToken.value);
    }
    if (this.check("Symbol" /* Symbol */) && !["&", "|"].includes(this.peek().value)) {
      const nameToken = this.advance();
      return makeVariablePattern(nameToken.value);
    }
    if (this.check("Number" /* Number */)) {
      const token = this.advance();
      return makeLiteralPattern("number", parseFloat(token.value));
    }
    if (this.check("String" /* String */)) {
      const token = this.advance();
      return makeLiteralPattern("string", token.value);
    }
    if (this.check("LParen" /* LParen */)) {
      this.advance();
      if (this.check("Symbol" /* Symbol */) && this.peek().value === "range") {
        this.advance();
        const minToken = this.advance();
        const maxToken = this.advance();
        this.expect("RParen" /* RParen */);
        return makeRangePattern(parseFloat(minToken.value), parseFloat(maxToken.value));
      }
      const pattern = this.parsePattern();
      this.expect("RParen" /* RParen */);
      return pattern;
    }
    if (this.check("LBracket" /* LBracket */)) {
      this.advance();
      const elements = [];
      let restElement;
      while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
        if (this.check("Symbol" /* Symbol */) && this.peek().value === "&") {
          this.advance();
          if (this.check("Symbol" /* Symbol */)) {
            const nameToken = this.advance();
            restElement = nameToken.value;
          }
          break;
        }
        elements.push(this.parsePattern());
      }
      this.expect("RBracket" /* RBracket */);
      return makeListPattern(elements, restElement);
    }
    if (this.check("LBrace" /* LBrace */)) {
      this.advance();
      const fields = /* @__PURE__ */ new Map();
      let asBinding;
      while (!this.check("RBrace" /* RBrace */) && !this.isAtEnd()) {
        let fieldName;
        if (this.check("Colon" /* Colon */)) {
          this.advance();
          if (!this.check("Symbol" /* Symbol */)) break;
          const keyToken = this.advance();
          fieldName = keyToken.value;
        } else if (this.check("Keyword" /* Keyword */)) {
          const keyToken = this.advance();
          fieldName = keyToken.value.startsWith(":") ? keyToken.value.slice(1) : keyToken.value;
        } else {
          break;
        }
        if (fieldName === "as") {
          if (this.check("Variable" /* Variable */)) {
            asBinding = this.advance().value;
          }
          continue;
        }
        const pattern = this.parsePattern();
        fields.set(fieldName, pattern);
      }
      this.expect("RBrace" /* RBrace */);
      if (!asBinding && this.check("Colon" /* Colon */)) {
        const savedPos = this.pos;
        this.advance();
        if (this.check("Symbol" /* Symbol */) && this.peek().value === "as") {
          this.advance();
          if (this.check("Variable" /* Variable */)) {
            asBinding = this.advance().value;
          }
        } else {
          this.pos = savedPos;
        }
      }
      return makeStructPattern(fields, asBinding);
    }
    if (this.check("Keyword" /* Keyword */)) {
      const fields = /* @__PURE__ */ new Map();
      let asBinding;
      while (this.check("Keyword" /* Keyword */) && !this.isAtEnd()) {
        const keyToken = this.advance();
        const fieldName = keyToken.value.startsWith(":") ? keyToken.value.slice(1) : keyToken.value;
        if (fieldName === "as") {
          if (this.check("Variable" /* Variable */)) {
            asBinding = this.advance().value;
          }
          break;
        }
        const pattern = this.parsePattern();
        fields.set(fieldName, pattern);
      }
      return makeStructPattern(fields, asBinding);
    }
    throw this.error(`Expected pattern, got ${this.peek().type}`, this.peek());
  }
  // Parse match expression: (match value (pattern body) (pattern body) ... [default])
  // Note: Opening paren '(' already consumed by parseSExpr
  parsePatternMatch() {
    const value = this.parseValue();
    const cases = [];
    let defaultCase;
    while (this.check("LParen" /* LParen */) && !this.isAtEnd()) {
      this.advance();
      if (this.check("Symbol" /* Symbol */) && this.peek().value === "default") {
        this.advance();
        defaultCase = this.parseValue();
        this.expect("RParen" /* RParen */);
        break;
      }
      const pattern = this.parsePattern();
      let guard;
      if (this.check("LParen" /* LParen */) && (this.peekNext()?.value === "if" || this.peekNext()?.value === "when")) {
        const savedPos = this.pos;
        this.advance();
        const guardKeyword = this.advance().value;
        const possibleGuard = this.parseValue();
        if (this.check("RParen" /* RParen */)) {
          this.advance();
          guard = possibleGuard;
        } else if (guardKeyword === "when") {
          this.pos = savedPos;
        } else {
          this.pos = savedPos;
        }
      }
      const body = this.parseValue();
      cases.push(makeMatchCase(pattern, body, guard));
      this.expect("RParen" /* RParen */);
    }
    return makePatternMatch(value, cases, defaultCase);
  }
  // ===== Utility Methods =====
  peek() {
    if (this.pos >= this.tokens.length) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[this.pos];
  }
  peekNext() {
    if (this.pos + 1 >= this.tokens.length) return null;
    return this.tokens[this.pos + 1];
  }
  advance() {
    if (this.pos < this.tokens.length) this.pos++;
    return this.tokens[this.pos - 1];
  }
  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  expect(type) {
    if (this.check(type)) {
      const tok = this.advance();
      if (type === "LParen" /* LParen */ || type === "LBracket" /* LBracket */ || type === "LBrace" /* LBrace */) {
        this.parenStack.push({ type, line: tok.line, col: tok.col });
      } else if (type === "RParen" /* RParen */ || type === "RBracket" /* RBracket */ || type === "RBrace" /* RBrace */) {
        this.parenStack.pop();
      }
      return tok;
    }
    const token = this.peek();
    let extraHint = "";
    if ((type === "RParen" /* RParen */ || type === "RBracket" /* RBracket */ || type === "RBrace" /* RBrace */) && this.parenStack.length > 0) {
      const opening = this.parenStack[this.parenStack.length - 1];
      const openSym = opening.type === "LParen" /* LParen */ ? "(" : opening.type === "LBracket" /* LBracket */ ? "[" : "{";
      const wantSym = type === "RParen" /* RParen */ ? ")" : type === "RBracket" /* RBracket */ ? "]" : "}";
      extraHint = ` (\uAC00\uC7A5 \uCD5C\uADFC opening '${openSym}' at line ${opening.line}:${opening.col} \u2014 '${wantSym}' \uB204\uB77D \uB610\uB294 \uC911\uCCA9 \uC624\uB958)`;
    }
    throw this.error(`Expected ${type}, got ${token.type}${extraHint}`, token);
  }
  isAtEnd() {
    return this.pos >= this.tokens.length;
  }
  error(message, token) {
    let hint = Object.entries(ERROR_HINTS).find(([k]) => message.includes(k))?.[1];
    if (this.parenStack.length > 0 && (token.type === "EOF" /* EOF */ || message.includes("Expected R") || message.includes("Unexpected"))) {
      const stackInfo = this.parenStack.map((opening, idx) => {
        const openSym = opening.type === "LParen" /* LParen */ ? "(" : opening.type === "LBracket" /* LBracket */ ? "[" : "{";
        const depth = idx + 1;
        return `  [${depth}] '${openSym}' at line ${opening.line}:${opening.col}`;
      }).join("\n");
      const closeSeq = this.parenStack.map((o) => o.type === "LParen" /* LParen */ ? ")" : o.type === "LBracket" /* LBracket */ ? "]" : "}").reverse().join("");
      const nextOpening = this.parenStack[this.parenStack.length - 1];
      const nextExpected = nextOpening.type === "LParen" /* LParen */ ? ")" : nextOpening.type === "LBracket" /* LBracket */ ? "]" : "}";
      const parenHint = `\uBBF8\uB2EB\uD798 \uAD04\uD638 \uC2A4\uD0DD (\uAE4A\uC774: ${this.parenStack.length}):
${stackInfo}

\uD544\uC694\uD55C \uB2EB\uD798 \uAD04\uD638 \uC2DC\uD000\uC2A4: ${closeSeq}

\uB2E4\uC74C \uD1A0\uD070\uC744 \uC608\uC0C1: '${nextExpected}'`;
      hint = hint ? `${hint}

${parenHint}` : parenHint;
    }
    let code = "E_PARSE_SYNTAX_ERROR";
    if (message.includes("Expected") || message.includes("Unexpected")) {
      code = "E_PARSE_UNEXPECTED_TOKEN";
    } else if (message.includes("Unterminated")) {
      code = "E_PARSE_UNCLOSED_PAREN";
    } else if (message.includes("Expected block")) {
      code = "E_PARSE_SYNTAX_ERROR";
    }
    return new ParserError(message, token.line, token.col, hint, code, "parse");
  }
  // Synchronization for error recovery
  synchronize() {
    this.advance();
    while (!this.isAtEnd()) {
      if (this.check("LBracket" /* LBracket */)) return;
      this.advance();
    }
  }
  // Phase 6: Parse import expression (import math :from "./math.fl" :as m :only [add])
  parseImportExpression() {
    const moduleName = this.parseQualifiedIdentifier();
    let source;
    let selective;
    let alias;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }
        const clauseName = this.advance().value;
        switch (clauseName) {
          case "from":
            if (!this.check("String" /* String */)) {
              throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
            }
            source = this.advance().value;
            break;
          case "only":
            if (!this.check("LBracket" /* LBracket */)) {
              throw this.error(`Expected [ after :only, got ${this.peek().type}`, this.peek());
            }
            selective = this.parseSelectiveImport();
            break;
          case "as":
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after :as, got ${this.peek().type}`, this.peek());
            }
            alias = this.advance().value;
            break;
          default:
            throw this.error(`Unknown import clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in import expression, got ${this.peek().type}`, this.peek());
      }
    }
    return makeImportBlock(moduleName, source, selective, alias);
  }
  // Phase 6: Parse open expression (open math :from "./math.fl")
  parseOpenExpression() {
    const moduleName = this.parseQualifiedIdentifier();
    let source;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(
            `Expected symbol after ':', got ${this.peek().type}`,
            this.peek()
          );
        }
        const clauseName = this.advance().value;
        if (clauseName === "from") {
          if (!this.check("String" /* String */)) {
            throw this.error(`Expected string after :from, got ${this.peek().type}`, this.peek());
          }
          source = this.advance().value;
        } else {
          throw this.error(`Unknown open clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in open expression, got ${this.peek().type}`, this.peek());
      }
    }
    return makeOpenBlock(moduleName, source);
  }
  // Phase 9a: Parse search expression
  // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
  parseSearchExpression() {
    let query = "";
    const queryNode = this.parseValue();
    if (queryNode.kind === "literal" && queryNode.type === "string") {
      query = queryNode.value;
    } else {
      throw this.error(`Expected string query in search expression`, this.peek());
    }
    let source = "web";
    let cache = false;
    let limit = 10;
    let name;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }
        const clauseName = this.advance().value;
        switch (clauseName) {
          case "source":
            if (!this.check("String" /* String */)) {
              throw this.error(`Expected string after :source`, this.peek());
            }
            const sourceVal = this.advance().value;
            if (sourceVal === "web" || sourceVal === "api" || sourceVal === "kb") {
              source = sourceVal;
            } else {
              throw this.error(`Invalid source: ${sourceVal}`, this.peek());
            }
            break;
          case "cache":
            const cacheVal = this.parseValue();
            if (cacheVal.kind === "literal") {
              cache = cacheVal.value === "true" || cacheVal.value === true;
            }
            break;
          case "limit":
            const limitVal = this.parseValue();
            if (limitVal.kind === "literal" && limitVal.type === "number") {
              limit = limitVal.value;
            }
            break;
          case "name":
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(`Expected symbol after :name`, this.peek());
            }
            name = this.advance().value;
            break;
          default:
            throw this.error(`Unknown search clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in search expression, got ${this.peek().type}`, this.peek());
      }
    }
    return {
      kind: "search-block",
      query,
      source,
      cache,
      limit,
      name
    };
  }
  // Phase 9a: Parse fetch expression
  // (fetch url :cache true|false)
  parseFetchExpression() {
    let query = "";
    const urlNode = this.parseValue();
    if (urlNode.kind === "literal" && urlNode.type === "string") {
      query = urlNode.value;
    } else {
      throw this.error(`Expected string URL in fetch expression`, this.peek());
    }
    let cache = false;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }
        const clauseName = this.advance().value;
        if (clauseName === "cache") {
          const cacheVal = this.parseValue();
          if (cacheVal.kind === "literal") {
            cache = cacheVal.value === "true" || cacheVal.value === true;
          }
        } else {
          throw this.error(`Unknown fetch clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in fetch expression, got ${this.peek().type}`, this.peek());
      }
    }
    return {
      kind: "search-block",
      query,
      source: "api",
      cache
    };
  }
  // Phase 9b: Parse learn expression
  // (learn key data :source "search" :confidence 0.95)
  parseLearnExpression() {
    let key = "";
    const keyNode = this.parseValue();
    if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
      key = keyNode.value;
    } else if (keyNode.kind === "variable") {
      key = keyNode.name;
    } else {
      throw this.error(`Expected symbol/string key in learn expression`, this.peek());
    }
    let data = null;
    if (!this.check("Colon" /* Colon */) && !this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      data = this.parseValue();
    }
    let source = "search";
    let confidence;
    let timestamp;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }
        const clauseName = this.advance().value;
        switch (clauseName) {
          case "source":
            const sourceVal = this.parseValue();
            if (sourceVal.kind === "literal" && sourceVal.type === "string") {
              const srcStr = sourceVal.value;
              if (srcStr === "search" || srcStr === "feedback" || srcStr === "analysis") {
                source = srcStr;
              }
            }
            break;
          case "confidence":
            const confVal = this.parseValue();
            if (confVal.kind === "literal" && confVal.type === "number") {
              confidence = confVal.value;
            }
            break;
          case "timestamp":
            const timeVal = this.parseValue();
            if (timeVal.kind === "literal" && timeVal.type === "string") {
              timestamp = timeVal.value;
            }
            break;
          default:
            throw this.error(`Unknown learn clause: ${clauseName}`, this.peek());
        }
      } else {
        throw this.error(`Expected ':' in learn expression, got ${this.peek().type}`, this.peek());
      }
    }
    return {
      kind: "learn-block",
      key,
      data,
      source,
      confidence,
      timestamp
    };
  }
  // Phase 9b: Parse recall expression
  // (recall key) - retrieves learned data by key
  parseRecallExpression() {
    let key = "";
    const keyNode = this.parseValue();
    if (keyNode.kind === "literal" && (keyNode.type === "string" || keyNode.type === "symbol")) {
      key = keyNode.value;
    } else if (keyNode.kind === "variable") {
      key = keyNode.name;
    } else {
      throw this.error(`Expected symbol/string key in recall expression`, this.peek());
    }
    return {
      kind: "learn-block",
      key,
      data: null,
      // null indicates this is a recall operation
      source: "search"
    };
  }
  // Phase 9c: Parse reasoning expression
  // (observe "facts" :confidence 0.9)
  // (analyze :angle1 "perf" :angle2 "security" :selected "angle1")
  // (decide :choice "angle2" :reason "best performance")
  // (act :action "implement" :parameters {...})
  // (verify :result success :evidence [...])
  parseReasoningExpression(stage) {
    const data = /* @__PURE__ */ new Map();
    const metadata = {
      startTime: (/* @__PURE__ */ new Date()).toISOString()
    };
    let observations;
    let analysis;
    let decisions;
    let actions;
    let verifications;
    switch (stage) {
      case "observe": {
        if (!this.check("RParen" /* RParen */) && !this.check("Colon" /* Colon */)) {
          const obs = this.parseValue();
          observations = [obs];
          data.set("observation", obs);
        }
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                data.set(clauseName, clauseValue.value);
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(`Expected ':' in observe expression, got ${this.peek().type}`, this.peek());
          }
        }
        break;
      }
      case "analyze": {
        const angles = /* @__PURE__ */ new Map();
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            if (clauseName === "selected") {
              const selected = this.parseValue();
              data.set("selected", selected);
            } else {
              const angleValue = this.parseValue();
              angles.set(clauseName, angleValue);
            }
          } else {
            throw this.error(`Expected ':' in analyze expression, got ${this.peek().type}`, this.peek());
          }
        }
        data.set("angles", angles);
        analysis = Array.from(angles.values());
        break;
      }
      case "decide": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(`Expected ':' in decide expression, got ${this.peek().type}`, this.peek());
          }
        }
        decisions = [data.get("choice")];
        break;
      }
      case "act": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(`Expected ':' in act expression, got ${this.peek().type}`, this.peek());
          }
        }
        actions = [data.get("action")];
        break;
      }
      case "verify": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(`Expected ':' in verify expression, got ${this.peek().type}`, this.peek());
          }
        }
        verifications = [data.get("result")];
        break;
      }
    }
    metadata.endTime = (/* @__PURE__ */ new Date()).toISOString();
    return {
      kind: "reasoning-block",
      stage,
      data,
      observations,
      analysis,
      decisions,
      actions,
      verifications,
      metadata
    };
  }
  // Phase 9c Extension: Parse reasoning-sequence expression
  // (reasoning-sequence (observe ...) (analyze ...) (decide ...) (act ...) (verify ...))
  // Phase 9a/9b: Support search and learn blocks in sequences
  parseReasoningSequenceExpression() {
    const stages = [];
    const startTime = (/* @__PURE__ */ new Date()).toISOString();
    let feedbackLoop = void 0;
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      if (this.check("Colon" /* Colon */)) {
        this.advance();
        if (!this.check("Symbol" /* Symbol */)) {
          throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
        }
        const keyword = this.advance().value;
        if (keyword === "feedback") {
          feedbackLoop = {
            enabled: false,
            fromStage: "verify",
            toStage: "analyze",
            maxIterations: 3,
            confidenceDamping: 0.1
          };
          while (!this.check("RParen" /* RParen */) && !this.isAtEnd() && this.check("Colon" /* Colon */)) {
            this.advance();
            const feedbackKey = this.advance().value;
            switch (feedbackKey) {
              case "enabled":
                const enabledVal = this.parseValue();
                feedbackLoop.enabled = enabledVal.kind === "literal" && enabledVal.value === true;
                break;
              case "from":
                const fromVal = this.parseValue();
                if (fromVal.kind === "literal" && fromVal.type === "string") {
                  feedbackLoop.fromStage = fromVal.value;
                }
                break;
              case "to":
                const toVal = this.parseValue();
                if (toVal.kind === "literal" && toVal.type === "string") {
                  feedbackLoop.toStage = toVal.value;
                }
                break;
              case "max-iterations":
                const maxVal = this.parseValue();
                if (maxVal.kind === "literal" && maxVal.type === "number") {
                  feedbackLoop.maxIterations = maxVal.value;
                }
                break;
              case "damping":
                const dampVal = this.parseValue();
                if (dampVal.kind === "literal" && dampVal.type === "number") {
                  feedbackLoop.confidenceDamping = dampVal.value;
                }
                break;
              case "condition":
                feedbackLoop.condition = this.parseValue();
                break;
              default:
                throw this.error(`Unknown feedback option: ${feedbackKey}`, this.peek());
            }
          }
        } else {
          throw this.error(`Unknown option: ${keyword}`, this.peek());
        }
      } else if (this.check("LParen" /* LParen */)) {
        if (this.pos + 1 < this.tokens.length) {
          const nextToken = this.tokens[this.pos + 1];
          if (nextToken.type === "If" /* If */) {
            const conditionalBlock = this.parseConditionalReasoningBlock();
            stages.push(conditionalBlock);
            continue;
          }
          if (nextToken.type === "When" /* When */) {
            const whenBlock = this.parseWhenReasoningBlock();
            stages.push(whenBlock);
            continue;
          }
          if (nextToken.type === "Repeat" /* Repeat */ || nextToken.type === "While" /* While */) {
            const loopBlock = this.parseLoopReasoningBlock();
            stages.push(loopBlock);
            continue;
          }
          if (nextToken.type === "Search" /* Search */) {
            const searchBlock = this.parseSearchReasoningBlock();
            stages.push(searchBlock);
            continue;
          }
          if (nextToken.type === "Learn" /* Learn */) {
            const learnBlock = this.parseLearnReasoningBlock();
            stages.push(learnBlock);
            continue;
          }
        }
        this.advance();
        const stageToken = this.peek();
        const isReasoningStage = stageToken.type === "Observe" /* Observe */ || stageToken.type === "Analyze" /* Analyze */ || stageToken.type === "Decide" /* Decide */ || stageToken.type === "Act" /* Act */ || stageToken.type === "Verify" /* Verify */ || stageToken.type === "Symbol" /* Symbol */ && (stageToken.value === "observe" || stageToken.value === "analyze" || stageToken.value === "decide" || stageToken.value === "act" || stageToken.value === "verify");
        if (!isReasoningStage) {
          throw this.error(
            `Expected reasoning stage (observe/analyze/decide/act/verify), got ${stageToken.value}`,
            stageToken
          );
        }
        const stageName = stageToken.type === "Observe" /* Observe */ ? "observe" : stageToken.type === "Analyze" /* Analyze */ ? "analyze" : stageToken.type === "Decide" /* Decide */ ? "decide" : stageToken.type === "Act" /* Act */ ? "act" : stageToken.type === "Verify" /* Verify */ ? "verify" : stageToken.value;
        this.advance();
        const reasoningBlock = this.parseReasoningExpressionInternal(
          stageName
        );
        stages.push(reasoningBlock);
        this.expect("RParen" /* RParen */);
      } else if (this.check("If" /* If */)) {
        const conditionalBlock = this.parseConditionalReasoningBlock();
        stages.push(conditionalBlock);
      } else if (this.check("When" /* When */)) {
        const whenBlock = this.parseWhenReasoningBlock();
        stages.push(whenBlock);
      } else if (this.check("Repeat" /* Repeat */) || this.check("While" /* While */)) {
        const loopBlock = this.parseLoopReasoningBlock();
        stages.push(loopBlock);
      } else {
        throw this.error(
          `Expected '(' before reasoning block, 'if', 'when', 'repeat', 'while', or ':feedback', got ${this.peek().type}`,
          this.peek()
        );
      }
    }
    const endTime = (/* @__PURE__ */ new Date()).toISOString();
    return {
      kind: "reasoning-sequence",
      stages,
      metadata: {
        startTime,
        endTime,
        // Phase 9a/9b: Support search/learn blocks in execution path
        executionPath: stages.map((s) => {
          if ("stage" in s) return s.stage;
          if (s.kind === "search-block") return "search";
          if (s.kind === "learn-block") return "learn";
          return "unknown";
        })
      },
      feedbackLoop: feedbackLoop?.enabled ? feedbackLoop : void 0
    };
  }
  // Phase 11: Parse try-catch-finally expressions
  // (try body (catch [pattern] handler) (finally cleanup))
  // STRICT MODE: body는 최대 1개 표현식만 허용. 여러 개는 do로 감싸야 함.
  parseTryExpression() {
    const bodyExprs = [];
    if (this.check("LParen" /* LParen */) && this.pos + 1 < this.tokens.length) {
      const nextToken = this.tokens[this.pos + 1];
      if (!(nextToken.type === "Symbol" /* Symbol */ && (nextToken.value === "catch" || nextToken.value === "finally"))) {
        bodyExprs.push(this.parseValue());
        if (this.check("LParen" /* LParen */) && this.pos + 1 < this.tokens.length) {
          const afterBodyToken = this.tokens[this.pos + 1];
          if (!(afterBodyToken.type === "Symbol" /* Symbol */ && (afterBodyToken.value === "catch" || afterBodyToken.value === "finally"))) {
            const line = afterBodyToken.line || 0;
            throw new SyntaxError(
              `Strict try-catch syntax: after body expression, expected 'catch' or 'finally', got '${afterBodyToken.value}' at line ${line}. For multiple body expressions, wrap with (do ...)`
            );
          }
        } else if (!this.check("RParen" /* RParen */)) {
          throw new SyntaxError(
            `Strict try-catch syntax: expected 'catch', 'finally', or ')' after try body. Got unexpected token at line ${this.peek().line || 0}`
          );
        }
      }
    }
    const body = bodyExprs.length === 1 ? bodyExprs[0] : makeSExpr("do", bodyExprs);
    const catchClauses = [];
    let finallyBlock;
    while (this.check("LParen" /* LParen */) && !this.isAtEnd()) {
      const clauseToken = this.peek();
      if (this.pos + 1 < this.tokens.length) {
        const nextToken = this.tokens[this.pos + 1];
        if (nextToken.type === "Symbol" /* Symbol */ && nextToken.value === "catch") {
          this.advance();
          this.advance();
          let pattern;
          let variable;
          if (this.check("LBracket" /* LBracket */)) {
            this.advance();
            if (this.check("Symbol" /* Symbol */)) {
              const patternName = this.advance().value;
              variable = patternName;
              pattern = makeVariablePattern(patternName);
            }
            this.expect("RBracket" /* RBracket */);
          } else if (this.check("Symbol" /* Symbol */) || this.check("Variable" /* Variable */)) {
            const paramToken = this.advance();
            variable = paramToken.value;
            pattern = makeVariablePattern(paramToken.value);
          }
          const handlerExprs = [];
          while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
            handlerExprs.push(this.parseValue());
          }
          const handler = handlerExprs.length === 1 ? handlerExprs[0] : makeSExpr("do", handlerExprs);
          catchClauses.push(makeCatchClause(handler, pattern, variable));
          this.expect("RParen" /* RParen */);
        } else if (nextToken.type === "Symbol" /* Symbol */ && nextToken.value === "finally") {
          this.advance();
          this.advance();
          const finallyExprs = [];
          while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
            finallyExprs.push(this.parseValue());
          }
          finallyBlock = finallyExprs.length === 1 ? finallyExprs[0] : makeSExpr("do", finallyExprs);
          this.expect("RParen" /* RParen */);
          break;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    return makeTryBlock(body, catchClauses.length > 0 ? catchClauses : void 0, finallyBlock);
  }
  // Phase 11: Parse throw expressions
  // (throw error-value)
  parseThrowExpression() {
    const argument = this.parseValue();
    return makeThrowExpression(argument);
  }
  // Phase B-1: Parse loop expressions
  // (loop [($var init) condition update] body)
  parseLoopExpression() {
    const startLine = this.peek().line || 0;
    this.expect("LBracket" /* LBracket */);
    const init = this.parseValue();
    const condition = this.parseValue();
    const update = this.parseValue();
    this.expect("RBracket" /* RBracket */);
    const bodyExprs = [];
    while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
      bodyExprs.push(this.parseValue());
    }
    const body = bodyExprs.length === 1 ? bodyExprs[0] : makeSExpr("do", bodyExprs);
    return {
      kind: "loop",
      init,
      condition,
      update,
      body,
      line: startLine
    };
  }
  // Phase 9c: Internal helper for parsing reasoning expressions (used by parseReasoningExpression and parseReasoningSequenceExpression)
  parseReasoningExpressionInternal(stage) {
    const data = /* @__PURE__ */ new Map();
    let observations = [];
    let analysis = [];
    let decisions = [];
    let actions = [];
    let verifications = [];
    const metadata = { startTime: (/* @__PURE__ */ new Date()).toISOString() };
    switch (stage) {
      case "observe": {
        if (!this.check("RParen" /* RParen */)) {
          const firstArg = this.parseValue();
          if (firstArg.kind === "literal" && firstArg.type === "string") {
            data.set("observation", firstArg.value);
            observations.push(firstArg.value);
          }
        }
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            if (!this.check("Symbol" /* Symbol */)) {
              throw this.error(
                `Expected symbol after ':', got ${this.peek().type}`,
                this.peek()
              );
            }
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in observe expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        break;
      }
      case "analyze": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
            if (clauseName === "selected") {
              analysis.push(clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in analyze expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        break;
      }
      case "decide": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(
              `Expected ':' in decide expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        decisions = [data.get("choice")];
        break;
      }
      case "act": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            data.set(clauseName, clauseValue);
          } else {
            throw this.error(
              `Expected ':' in act expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        actions = [data.get("action")];
        break;
      }
      case "verify": {
        while (!this.check("RParen" /* RParen */) && !this.isAtEnd()) {
          if (this.check("Colon" /* Colon */)) {
            this.advance();
            const clauseName = this.advance().value;
            const clauseValue = this.parseValue();
            if (clauseName === "confidence") {
              if (clauseValue.kind === "literal" && clauseValue.type === "number") {
                metadata.confidence = clauseValue.value;
              }
            } else {
              data.set(clauseName, clauseValue);
            }
          } else {
            throw this.error(
              `Expected ':' in verify expression, got ${this.peek().type}`,
              this.peek()
            );
          }
        }
        verifications = [data.get("result")];
        break;
      }
    }
    metadata.endTime = (/* @__PURE__ */ new Date()).toISOString();
    return {
      kind: "reasoning-block",
      stage,
      data,
      observations,
      analysis,
      decisions,
      actions,
      verifications,
      metadata
    };
  }
  // Phase 6: Parse qualified identifier (math or math:add or utils:double:helper)
  // IMPORTANT: Stop when encountering keyword colons like :from, :as, :only
  parseQualifiedIdentifier() {
    if (!this.check("Symbol" /* Symbol */)) {
      throw this.error(`Expected symbol, got ${this.peek().type}`, this.peek());
    }
    const parts = [];
    parts.push(this.advance().value);
    const keywordColons = /* @__PURE__ */ new Set(["from", "as", "only", "to", "body", "params", "exports"]);
    while (this.check("Colon" /* Colon */)) {
      const peekPos = this.pos + 1;
      if (peekPos >= this.tokens.length) break;
      const nextToken = this.tokens[peekPos];
      if (nextToken.type === "Symbol" /* Symbol */ && keywordColons.has(nextToken.value)) {
        break;
      }
      this.advance();
      if (!this.check("Symbol" /* Symbol */)) {
        throw this.error(`Expected symbol after ':', got ${this.peek().type}`, this.peek());
      }
      parts.push(this.advance().value);
    }
    return parts.join(":");
  }
  // Phase 6: Parse selective import list: [func1 func2 ...]
  parseSelectiveImport() {
    this.expect("LBracket" /* LBracket */);
    const names = [];
    while (!this.check("RBracket" /* RBracket */) && !this.isAtEnd()) {
      if (!this.check("Symbol" /* Symbol */)) {
        throw this.error(`Expected symbol in import list, got ${this.peek().type}`, this.peek());
      }
      names.push(this.advance().value);
    }
    this.expect("RBracket" /* RBracket */);
    return names;
  }
  // Phase 9c: Parse if/then/else conditional reasoning block
  // Format: (if condition (thenBlock) (elseBlock)?)
  parseConditionalReasoningBlock() {
    this.expect("LParen" /* LParen */);
    this.expect("If" /* If */);
    const condition = this.parseValue();
    if (!this.check("LParen" /* LParen */)) {
      throw this.error(`Expected '(' for then block, got ${this.peek().type}`, this.peek());
    }
    this.advance();
    const thenStageToken = this.peek();
    const thenStageName = this.getReasoningStageName(thenStageToken);
    if (!thenStageName) {
      throw this.error(
        `Expected reasoning stage in then block, got ${thenStageToken.value}`,
        thenStageToken
      );
    }
    this.advance();
    const thenBlock = this.parseReasoningExpressionInternal(
      thenStageName
    );
    this.expect("RParen" /* RParen */);
    let elseBlock = void 0;
    if (this.check("LParen" /* LParen */)) {
      const nextIdx = this.pos + 1;
      if (nextIdx < this.tokens.length) {
        const nextToken = this.tokens[nextIdx];
        const elseStageName = this.getReasoningStageName(nextToken);
        if (elseStageName) {
          this.advance();
          this.advance();
          elseBlock = this.parseReasoningExpressionInternal(
            elseStageName
          );
          this.expect("RParen" /* RParen */);
        }
      }
    }
    this.expect("RParen" /* RParen */);
    return {
      ...thenBlock,
      conditional: { condition, thenBlock, elseBlock }
    };
  }
  // Phase 9c: Parse when guard clause
  // Format: (when condition (block))
  parseWhenReasoningBlock() {
    this.expect("LParen" /* LParen */);
    this.expect("When" /* When */);
    const condition = this.parseValue();
    if (!this.check("LParen" /* LParen */)) {
      throw this.error(`Expected '(' for when block, got ${this.peek().type}`, this.peek());
    }
    this.advance();
    const stageToken = this.peek();
    const stageName = this.getReasoningStageName(stageToken);
    if (!stageName) {
      throw this.error(`Expected reasoning stage in when block, got ${stageToken.value}`, stageToken);
    }
    this.advance();
    const block = this.parseReasoningExpressionInternal(
      stageName
    );
    this.expect("RParen" /* RParen */);
    this.expect("RParen" /* RParen */);
    return {
      ...block,
      whenGuard: condition
    };
  }
  // Phase 9c: Parse loop control (repeat-until or repeat-while)
  // Format: (repeat-until condition (block))
  //         (repeat-while condition (block))
  // Phase 9a: Parse search block in reasoning sequence
  // (search query :source "web"|"api"|"kb" :cache true|false :limit 5)
  parseSearchReasoningBlock() {
    this.expect("LParen" /* LParen */);
    this.expect("Search" /* Search */);
    const searchBlock = this.parseSearchExpression();
    this.expect("RParen" /* RParen */);
    return searchBlock;
  }
  // Phase 9b: Parse learn block in reasoning sequence
  // (learn key data :source "search"|"feedback"|"analysis" :confidence 0.95)
  parseLearnReasoningBlock() {
    this.expect("LParen" /* LParen */);
    this.expect("Learn" /* Learn */);
    const learnBlock = this.parseLearnExpression();
    this.expect("RParen" /* RParen */);
    return learnBlock;
  }
  parseLoopReasoningBlock() {
    this.expect("LParen" /* LParen */);
    const loopTypeToken = this.peek();
    const isRepeat = loopTypeToken.type === "Repeat" /* Repeat */;
    const isWhile = loopTypeToken.type === "While" /* While */;
    if (!isRepeat && !isWhile) {
      throw this.error(
        `Expected 'repeat' or 'while' in loop, got ${loopTypeToken.type}`,
        loopTypeToken
      );
    }
    this.advance();
    let loopType;
    if (isRepeat) {
      this.expect("Until" /* Until */);
      loopType = "repeat-until";
    } else {
      loopType = "repeat-while";
    }
    const condition = this.parseValue();
    if (!this.check("LParen" /* LParen */)) {
      throw this.error(`Expected '(' for loop block, got ${this.peek().type}`, this.peek());
    }
    this.advance();
    const stageToken = this.peek();
    const stageName = this.getReasoningStageName(stageToken);
    if (!stageName) {
      throw this.error(`Expected reasoning stage in loop block, got ${stageToken.value}`, stageToken);
    }
    this.advance();
    const block = this.parseReasoningExpressionInternal(
      stageName
    );
    this.expect("RParen" /* RParen */);
    this.expect("RParen" /* RParen */);
    return {
      ...block,
      loopControl: {
        type: loopType,
        condition
      }
    };
  }
  // Phase 11: Parse PAGE block - [PAGE name :path "/" :render "<h1>...</h1>" :title "..." :component ComponentName]
  parsePage(name, fields, line) {
    const path2 = this.extractStringField(fields, "path");
    const title = this.extractStringField(fields, "title");
    const render = this.extractStringField(fields, "render");
    const component = this.extractSymbolField(fields, "component");
    const metadata = this.extractMapField(fields, "metadata");
    const pageNode = makePageNode(name, title, path2, component, metadata, line);
    if (render) {
      pageNode.fields = pageNode.fields || /* @__PURE__ */ new Map();
      pageNode.fields.set("render", { kind: "literal", type: "string", value: render });
    }
    return pageNode;
  }
  // Phase 11: Parse ROUTE block - [ROUTE name :path "/api/users/:id" :method "GET" :handler handlerName]
  parseRoute(name, fields, line) {
    const path2 = this.extractStringField(fields, "path");
    const method = this.extractStringField(fields, "method");
    const handler = this.extractSymbolField(fields, "handler");
    const middleware = this.extractSymbolArrayField(fields, "middleware");
    const validation = this.extractSymbolField(fields, "validation");
    return makeRouteNode(name, path2, method, handler, middleware, validation, line);
  }
  // Phase 11: Parse COMPONENT block - [COMPONENT name :render renderFn :state stateName :methods [...]]
  parseComponent(name, fields, line) {
    const render = this.extractSymbolField(fields, "render");
    const state = this.extractSymbolField(fields, "state");
    const computed = this.extractSymbolArrayField(fields, "computed");
    const watch = this.extractWatchField(fields, "watch");
    const methods = this.extractMethodsField(fields, "methods");
    const slots = this.extractSymbolArrayField(fields, "slots");
    return makeComponentNode(name, render, state, computed, watch, methods, slots, line);
  }
  // Phase 11: Parse FORM block - [FORM name :fields [...] :validation validationFn :submit submitFn]
  parseForm(name, fields, line) {
    const formFields = this.extractMapField(fields, "fields");
    const validation = this.extractSymbolField(fields, "validation");
    const submit = this.extractSymbolField(fields, "submit");
    const handlers = this.extractHandlersField(fields, "handlers");
    return makeFormNode(name, formFields, validation, submit, handlers, line);
  }
  // Helper: Extract string field from block fields
  extractStringField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first.kind === "literal" && first.type === "string") {
        return first.value;
      }
    } else if (value.kind === "literal" && value.type === "string") {
      return value.value;
    }
    return void 0;
  }
  // Helper: Extract symbol field from block fields
  extractSymbolField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    if (Array.isArray(value)) {
      const first = value[0];
      if (first.kind === "literal" && first.type === "symbol") {
        return first.value;
      }
    } else if (value.kind === "literal" && value.type === "symbol") {
      return value.value;
    }
    return void 0;
  }
  // Helper: Extract array of symbols from block fields
  extractSymbolArrayField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    const items = [];
    let arrayItems = [];
    if (Array.isArray(value)) {
      arrayItems = value;
    } else if (value.kind === "block" && value.type === "Array") {
      const innerItems = value.fields?.get("items");
      if (Array.isArray(innerItems)) {
        arrayItems = innerItems;
      }
    }
    for (const item of arrayItems) {
      if (item.kind === "literal" && item.type === "symbol") {
        items.push(item.value);
      }
    }
    return items.length > 0 ? items : void 0;
  }
  // Helper: Extract map field from block fields
  extractMapField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    const result = /* @__PURE__ */ new Map();
    if (value.kind === "block" && value.type === "Map") {
      const innerFields = value.fields;
      if (innerFields) {
        for (const [k, v] of innerFields) {
          result.set(k, v);
        }
      }
    }
    return result.size > 0 ? result : void 0;
  }
  // Helper: Extract watch field from block fields (map of property names to handler names)
  extractWatchField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    const result = /* @__PURE__ */ new Map();
    if (value.kind === "block" && value.type === "Map") {
      const innerFields = value.fields;
      if (innerFields) {
        for (const [k, v] of innerFields) {
          if (v.kind === "literal" && v.type === "symbol") {
            result.set(k, v.value);
          }
        }
      }
    }
    return result.size > 0 ? result : void 0;
  }
  // Helper: Extract methods field from block fields (map of method names to function names)
  extractMethodsField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    const result = /* @__PURE__ */ new Map();
    if (value.kind === "block" && value.type === "Map") {
      const innerFields = value.fields;
      if (innerFields) {
        for (const [k, v] of innerFields) {
          if (v.kind === "literal" && v.type === "symbol") {
            result.set(k, v.value);
          }
        }
      }
    }
    return result.size > 0 ? result : void 0;
  }
  // Helper: Extract handlers field from block fields (map of event names to handler names)
  extractHandlersField(fields, key) {
    const value = fields.get(key);
    if (!value) return void 0;
    const result = /* @__PURE__ */ new Map();
    if (value.kind === "block" && value.type === "Map") {
      const innerFields = value.fields;
      if (innerFields) {
        for (const [k, v] of innerFields) {
          if (v.kind === "literal" && v.type === "symbol") {
            result.set(k, v.value);
          }
        }
      }
    }
    return result.size > 0 ? result : void 0;
  }
  // Helper: Get reasoning stage name from token
  getReasoningStageName(token) {
    if (token.type === "Observe" /* Observe */) return "observe";
    if (token.type === "Analyze" /* Analyze */) return "analyze";
    if (token.type === "Decide" /* Decide */) return "decide";
    if (token.type === "Act" /* Act */) return "act";
    if (token.type === "Verify" /* Verify */) return "verify";
    if (token.type === "Symbol" /* Symbol */) {
      if (token.value === "observe") return "observe";
      if (token.value === "analyze") return "analyze";
      if (token.value === "decide") return "decide";
      if (token.value === "act") return "act";
      if (token.value === "verify") return "verify";
    }
    return null;
  }
};
function parse(tokens) {
  const parser = new Parser(tokens);
  return parser.parse();
}

// src/runtime-helpers.ts
function generateRuntimePreamble() {
  return `
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// FreeLang v11 Runtime Helpers (Enhanced 2026-04-30)
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// \u2500 \uC0B0\uC220 \uBC0F \uB17C\uB9AC \uC5F0\uC0B0\uC790 (stdlib) \u2500
function _plus(...args) { if (args.length === 0) return 0; if (args.length === 1) return args[0]; return args.reduce((a, b) => a + b); }
function _minus(...args) { if (args.length === 0) return 0; if (args.length === 1) return -args[0]; return args.reduce((a, b) => a - b); }
function _star(...args) { if (args.length === 0) return 1; if (args.length === 1) return args[0]; return args.reduce((a, b) => a * b); }
function _slash(...args) { if (args.length === 0) return 1; if (args.length === 1) return 1/args[0]; return args.reduce((a, b) => a / b); }
function _gt(a, b) { return a > b; }
function _lt(a, b) { return a < b; }
function _eq(a, b) { return a === b; }
function _gt_eq(a, b) { return a >= b; }
function _lt_eq(a, b) { return a <= b; }
function _not(a) { return !a; }
function _and(...args) { for(let a of args) if(!a) return false; return args.length > 0 ? args[args.length-1] : true; }
function _or(...args) { for(let a of args) if(a) return a; return false; }
function _concat(...args) { 
  if (args.length === 0) return "";
  if (Array.isArray(args[0])) return [].concat(...args);
  return args.join("");
}

// \u2500 \uD0C0\uC785 \uCCB4\uD06C \u2500
function _fl_null_q(v) { return v === null || v === undefined; }
function _fl_true_q(v) { return v === true; }
function _fl_false_q(v) { return v === false; }
function _fl_number_q(v) { return typeof v === 'number'; }
function _fl_string_q(v) { return typeof v === 'string'; }
function _fl_list_q(v) { return Array.isArray(v); }
function _fl_array_q(v) { return Array.isArray(v); }
function _fl_map_q(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function _fl_fn_q(v) { return typeof v === 'function'; }

// \u2500 \uB370\uC774\uD130 \uC811\uADFC \uBC0F \uC870\uC791 \u2500
function _fl_length(v) { if(v==null) return 0; return v.length !== undefined ? v.length : 0; }
function _fl_get(obj, key, dflt) {
  if (obj === null || obj === undefined) return dflt || null;
  if (obj instanceof Map) return obj.has(key) ? obj.get(key) : (dflt || null);
  
  let k = (typeof key === "object" && key !== null) ? (key.name || key.value || String(key)) : String(key);
  if (k.startsWith(":")) k = k.slice(1);

  if (Array.isArray(obj)) {
    if (typeof key === "number") return obj[key] !== undefined ? obj[key] : (dflt || null);
    if (k === "length") return obj.length;
    let idx = parseInt(k);
    if (!isNaN(idx)) return obj[idx] !== undefined ? obj[idx] : (dflt || null);
  }
  
  if (typeof obj === "object") {
    if (obj[k] !== undefined) return obj[k];
    if (obj[":" + k] !== undefined) return obj[":" + k];
  }
  return dflt || null;
}
function _fl_first(l) { return (l && l.length > 0) ? l[0] : null; }
function _fl_last(l) { return (l && l.length > 0) ? l[l.length - 1] : null; }
function _fl_rest(l) { return (l && l.length > 0) ? l.slice(1) : []; }
function _fl_append(l, x) { return [...(l || []), x]; }
function _fl_concat(a, b) { return Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : String(a || "") + String(b || ""); }
function _fl_keys(o) { return o ? Object.keys(o) : []; }
function _fl_values(o) { return o ? Object.values(o) : []; }
var _fl_entries = (o) => o ? Object.entries(o).map(([k,v]) => [k,v]) : [];
function _fl_map_set(o, ...args) { const result = {...(o || {})}; for (let i = 0; i + 1 < args.length; i += 2) { result[args[i]] = args[i + 1]; } return result; }
function _fl_has_key_q(o, k) { return o ? (String(k) in o) : false; }

// \u2500 \uBB38\uC790\uC5F4 \uC870\uC791 \u2500
function _fl_str(...xs) { return xs.map(x => x === null || x === undefined ? "" : (typeof x === "object" ? JSON.stringify(x) : String(x))).join(""); }
function _fl_char_at(s, i) { return (s && s[i]) || null; }
function _fl_substring(s, a, b) { return s ? (b === undefined ? s.slice(a) : s.slice(a, b)) : ""; }
function _fl_lower(s) { return String(s || "").toLowerCase(); }
function _fl_upper(s) { return String(s || "").toUpperCase(); }
function _fl_trim(s) { return String(s || "").trim(); }
function _fl_replace(s, a, b) { return String(s || "").split(a).join(b); }
function _fl_str_index_of(s, sub) { return (s || "").indexOf(sub); }
function _fl_contains_q(s, sub) { return (s || "").includes(sub); }
function _fl_str_to_num(s) { const n = Number(s); return isNaN(n) ? null : n; }
function _fl_join(arr, sep) { return (arr || []).join(sep !== undefined ? sep : ""); }
function _fl_split(s, sep) { return (s || "").split(sep !== undefined ? sep : ""); }
function _fl_repeat(s, n) { return (s || "").repeat(n || 0); }
function _fl_range(a, b, s) { let r = []; let start = b === undefined ? 0 : a; let end = b === undefined ? a : b; let step = s || 1; if (step > 0) { for (let i = start; i < end; i += step) r.push(i); } else { for (let i = start; i > end; i += step) r.push(i); } return r; }

// \u2500 \uACE0\uCC28 \uD568\uC218 (Null-safe & Spread) \u2500
function _fl_map(arr, fn) { return (arr || []).map(x => fn(x)); }
function _fl_filter(arr, fn) { return (arr || []).filter(x => { const r = fn(x); return r !== false && r !== null; }); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce((a, x) => fn(a, x), init); }

// \u2500 \uB370\uC774\uD130 \uC811\uADFC \uBC0F \uC870\uC791 \uBCF4\uC870 \u2500
function _fl_slice(l, a, b) { return (l || []).slice(a, b); }

// \u2500 \uC2DC\uC2A4\uD15C \uBC0F I/O \u2500
function _fl_print(v) { console.log(v); return v; }
function _fl_get_argv() { return (typeof process !== "undefined" ? process.argv.slice(2) : []); }
function _fl_file_read(p) { return require("fs").readFileSync(p, "utf8"); }
function _fl_file_write(p, c) { return require("fs").writeFileSync(p, c); }
function _fl_file_exists(p) { return require("fs").existsSync(p); }
function _fl_file_delete(p) { try { require("fs").unlinkSync(p); } catch(e) {} }
function _fl_file_append(p, c) { require("fs").appendFileSync(p, String(c)); }
function _fl_file_copy(s, d) { require("fs").copyFileSync(s, d); }
function _fl_file_rename(o, n) { require("fs").renameSync(o, n); }
function _fl_file_size(p) { try { return require("fs").statSync(p).size; } catch(e) { return 0; } }
function _fl_file_modified(p) { try { return require("fs").statSync(p).mtimeMs; } catch(e) { return 0; } }
function _fl_file_mkdir(p) { try { require("fs").mkdirSync(p, { recursive: true }); } catch(e) {} }
function _fl_file_rmdir(p) { try { require("fs").rmSync(p, { recursive: true, force: true }); } catch(e) {} }
function _fl_file_list(p) { try { return require("fs").readdirSync(p); } catch(e) { return []; } }
function _fl_process_run(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_run_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec(cmd) { try { const {execSync}=require("child_process"); return execSync(cmd,{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_exec_args(cmd, args) { try { const {execSync}=require("child_process"); return execSync(cmd+" "+(args||[]).join(" "),{encoding:"utf8"}); } catch(e) { return ""; } }
function _fl_process_spawn(cmd, args) { try { const {spawnSync}=require("child_process"); const r=spawnSync(cmd,args||[],{encoding:"utf8"}); return r.stdout||""; } catch(e) { return ""; } }
function _fl_run_inherit(cmd) { require("child_process").spawnSync(cmd,{shell:true,stdio:"inherit"}); }
function _fl_process_kill(pid) { try { process.kill(pid); } catch(e) {} }
function _fl_process_wait(pid) { return null; }
function _fl_env_get(k) { return process.env[k] || null; }
function _fl_env_set(k, v) { process.env[k] = String(v); }
function _fl_env_all() { return process.env; }
function _fl_file_is_file(p) { try { return require("fs").statSync(p).isFile(); } catch(e) { return false; } }
function _fl_file_is_dir(p) { try { return require("fs").statSync(p).isDirectory(); } catch(e) { return false; } }
function _fl_process_exists(pid) { try { process.kill(pid, 0); return true; } catch(e) { return false; } }
function _fl_process_getcwd() { return process.cwd(); }
function _fl_process_chdir(p) { try { process.chdir(p); } catch(e) {} }
function _fl_process_pid() { return process.pid; }
function _fl_process_ppid() { return process.ppid || null; }
function _fl_readline(prompt) {
  if (prompt) process.stdout.write(prompt);
  try {
    const fs = require("fs");
    const parts = [];
    const b = Buffer.alloc(1);
    while (true) {
      const n = fs.readSync(process.stdin.fd, b, 0, 1);
      if (n === 0) return parts.length === 0 ? null : parts.join("");
      const c = b[0];
      if (c === 10) break;
      if (c !== 13) parts.push(String.fromCharCode(c));
    }
    return parts.join("");
  } catch(e) { return null; }
}
function _fl_shell_capture(cmd) {
  try {
    const {execSync} = require("child_process");
    return {stdout: execSync(cmd, {encoding: "utf8"}), stderr: "", code: 0, ok: true};
  } catch(e) {
    return {stdout: "", stderr: String(e), code: 1, ok: false};
  }
}

// \u2500 \uD0C0\uC785 \u2500
function _fl_type_of(v) { if (v === null || v === undefined) return "nil"; if (Array.isArray(v)) return "list"; return typeof v; }

// \u2500 \uAE30\uD0C0 \u2500
function _while(condFn, bodyFn) { while(condFn()) { bodyFn(); } }

// \u2500 \uC2DC\uAC04 \u2500
const now_ms = () => Date.now();
const now_iso = () => new Date().toISOString();
const now_unix = () => Math.floor(Date.now() / 1000);

// \u2500 \uC178 \uC2E4\uD589 \u2500
const shell_exec = (cmd, inp) => { try { const {execSync} = require("child_process"); const opts = {encoding: "utf8"}; if (inp) opts["input"] = inp; return execSync(cmd, opts); } catch(e) { return ""; } };

// \u2500 \uC218\uD559 \u2500
var math_sqrt = (n) => Math.sqrt(n);
var math_pow = (a, b) => Math.pow(a, b);
var math_pi = Math.PI;
var round = (n) => Math.round(n);
var floor = (n) => Math.floor(n);
var ceil = (n) => Math.ceil(n);
var abs = (n) => Math.abs(n);
var min = (...args) => Math.min(...args);
var max = (...args) => Math.max(...args);

// \u2500 \uCEEC\uB809\uC158 \uD655\uC7A5 \u2500
function _fl_take(n, arr) { return (arr || []).slice(0, n); }
function _fl_drop(n, arr) { return (arr || []).slice(n); }
function _fl_zip(a, b) { const r = []; const l = Math.min((a || []).length, (b || []).length); for (let i = 0; i < l; i++) r.push([a[i], b[i]]); return r; }
function _fl_flatten(arr) { return (arr || []).flat(); }
function _fl_reverse(arr) { return Array.isArray(arr) ? [...arr].reverse() : arr; }
function _fl_sort(arr, fn) { return fn ? [...(arr || [])].sort((a, b) => fn(a, b) ? -1 : 1) : [...(arr || [])].sort(); }

// \u2500 \uBB38\uC790\uC5F4 \uACF5\uAC1C \uBCC4\uCE6D \u2500
var str_upper = (s) => String(s || "").toUpperCase();
var str_lower = (s) => String(s || "").toLowerCase();
var str_contains = (s, sub) => String(s || "").includes(String(sub || ""));
var str_replace = (s, a, b) => { if (s == null) return ""; return String(s).split(String(a || "")).join(String(b || "")); };
var str_starts_with = (s, p) => String(s || "").startsWith(String(p || ""));
var str_ends_with = (s, sf) => String(s || "").endsWith(String(sf || ""));
var str_trim = (s) => String(s || "").trim();
var str_length = (s) => String(s || "").length;
var str_split = (s, sep) => String(s || "").split(sep);

// \u2500 \uD0C0\uC785 \uD655\uC7A5 \u2500
var list_q = (v) => Array.isArray(v);
var map_q = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var fn_q = (v) => typeof v === "function";

// \u2500 IIFE \uD3F4\uBC31 \u2500
var unknown = (...a) => a[a.length - 1];

// \u2500 \uAE00\uB85C\uBC8C \uBC14\uC778\uB529 \u2500
let __argv__ = _fl_get_argv();

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
`.trim();
}
var HELPER_FUNCTIONS = [
  "_plus",
  "_minus",
  "_star",
  "_slash",
  "_gt",
  "_lt",
  "_eq",
  "_gt_eq",
  "_lt_eq",
  "_not",
  "_and",
  "_or",
  "_concat",
  "_fl_null_q",
  "_fl_true_q",
  "_fl_false_q",
  "_fl_number_q",
  "_fl_string_q",
  "_fl_list_q",
  "_fl_array_q",
  "_fl_map_q",
  "_fl_fn_q",
  "_fl_length",
  "_fl_get",
  "_fl_first",
  "_fl_last",
  "_fl_rest",
  "_fl_append",
  "_fl_concat",
  "_fl_keys",
  "_fl_values",
  "_fl_entries",
  "_fl_map_set",
  "_fl_has_key_q",
  "_fl_str",
  "_fl_char_at",
  "_fl_substring",
  "_fl_lower",
  "_fl_upper",
  "_fl_trim",
  "_fl_replace",
  "_fl_str_index_of",
  "_fl_contains_q",
  "_fl_str_to_num",
  "_fl_join",
  "_fl_split",
  "_fl_repeat",
  "_fl_range",
  "_fl_map",
  "_fl_filter",
  "_fl_reduce",
  "_fl_slice",
  "_fl_print",
  "_fl_get_argv",
  "_fl_file_read",
  "_fl_file_write",
  "_fl_file_exists",
  "_fl_shell_capture",
  "_fl_take",
  "_fl_drop",
  "_fl_zip",
  "_fl_flatten",
  "_fl_reverse",
  "_fl_sort"
];
var HELPER_COUNT = HELPER_FUNCTIONS.length;

// src/codegen-js.ts
var DEFAULT_OPTIONS = {
  module: "commonjs",
  runtime: false,
  minify: false,
  target: "node"
};
var FL_RUNTIME = `
function _fl_map(arr, fn) { return (arr || []).map(fn); }
function _fl_filter(arr, fn) { return (arr || []).filter(fn); }
function _fl_reduce(arr, fn, init) { return (arr || []).reduce(fn, init); }
function _fl_print(v) { console.log(v); return v; }
`.trim();
var BUILTIN_MAP = {
  // 타입 체크
  "null?": "_fl_null_q",
  "nil?": "_fl_null_q",
  "cli-args": "_fl_get_argv",
  "file_read": "_fl_file_read",
  "file-read": "_fl_file_read",
  "file_write": "_fl_file_write",
  "file-write": "_fl_file_write",
  "file-exists": "_fl_file_exists",
  "file_exists": "_fl_file_exists",
  "readline": "_fl_readline",
  "read-line": "_fl_readline",
  "char_at": "_fl_char_at",
  "char-at": "_fl_char_at",
  "substring": "_fl_substring",
  "str-slice": "_fl_substring",
  "true?": "_fl_true_q",
  "false?": "_fl_false_q",
  "string?": "_fl_string_q",
  "number?": "_fl_number_q",
  "list?": "_fl_list_q",
  "array?": "_fl_array_q",
  "map?": "_fl_map_q",
  "fn?": "_fl_fn_q",
  "boolean?": "_fl_boolean_q",
  "type-of": "_fl_type_of",
  "empty?": "_fl_empty_q",
  // 문자 검증 (lexer 헬퍼)
  "is-digit?": "_fl_is_digit_q",
  "is-alpha?": "_fl_is_alpha_q",
  "is-alnum?": "_fl_is_alnum_q",
  "is-space?": "_fl_is_space_q",
  "is-symbol-char?": "_fl_is_symbol_char_q",
  // 기본 연산
  "map": "_fl_map",
  "filter": "_fl_filter",
  "reduce": "_fl_reduce",
  "first": "_fl_first",
  "last": "_fl_last",
  "rest": "_fl_rest",
  "append": "_fl_append",
  "concat": "_fl_concat",
  "slice": "_fl_slice",
  "take": "_fl_take",
  "drop": "_fl_drop",
  "zip": "_fl_zip",
  "flatten": "_fl_flatten",
  "reverse": "_fl_reverse",
  "sort": "_fl_sort",
  "length": "_fl_length",
  "range": "_fl_range",
  // 문자열
  "str": "_fl_str",
  "contains?": "_fl_contains_q",
  "str-contains": "_fl_contains_q",
  "str-includes": "_fl_contains_q",
  "str-to-num": "_fl_str_to_num",
  "parse-num": "_fl_str_to_num",
  "assoc": "_fl_map_set",
  "upper": "_fl_upper",
  "str-upper": "_fl_upper",
  "lower": "_fl_lower",
  "str-lower": "_fl_lower",
  "trim": "_fl_trim",
  "replace": "_fl_replace",
  "str-replace": "_fl_replace",
  "str-index-of": "_fl_str_index_of",
  "str_index_of": "_fl_str_index_of",
  "join": "_fl_join",
  "str-join": "_fl_join",
  "split": "_fl_split",
  "str-split": "_fl_split",
  "repeat": "_fl_repeat",
  "str-repeat": "_fl_repeat",
  // 맵/객체
  "get": "_fl_get",
  "json-parse": "JSON.parse",
  "json-stringify": "JSON.stringify",
  "json_parse": "JSON.parse",
  "json_stringify": "JSON.stringify",
  "keys": "_fl_keys",
  "json_keys": "_fl_keys",
  "values": "_fl_values",
  "map-keys": "_fl_keys",
  "map-values": "_fl_values",
  "map-set": "_fl_map_set",
  "json-set": "_fl_map_set",
  "json_set": "_fl_map_set",
  "has-key?": "_fl_has_key_q"
};
var JS_RESERVED = /* @__PURE__ */ new Set([
  "abstract",
  "arguments",
  "await",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "function",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "int",
  "interface",
  "let",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "volatile",
  "while",
  "with",
  "yield"
]);
function flNameToJs(name) {
  if (BUILTIN_MAP[name]) {
    return BUILTIN_MAP[name];
  }
  const cleanName = name.replace(/^\$/, "");
  const encoded = cleanName.replace(/\?$/g, "_q").replace(/!/g, "_bang").replace(/>/g, "_gt").replace(/</g, "_lt").replace(/=/g, "_eq").replace(/\+/g, "_plus").replace(/\*/g, "_star").replace(/\//g, "_slash").replace(/-/g, "_");
  if (JS_RESERVED.has(encoded)) {
    return `_${encoded}`;
  }
  return encoded;
}
var JSCodegen = class {
  constructor() {
    this.exportedNames = [];
    this.opts = { ...DEFAULT_OPTIONS };
  }
  generate(nodes, opts) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.exportedNames = [];
    const parts = [];
    parts.push(generateRuntimePreamble());
    parts.push("");
    if (this.opts.runtime) {
      parts.push(FL_RUNTIME);
      parts.push("");
    }
    const bodyParts = [];
    for (const node of nodes) {
      const code = this.genNode(node);
      if (code !== "") {
        bodyParts.push(code.endsWith(";") ? code : code + ";");
      }
    }
    parts.push(...bodyParts);
    if (this.exportedNames.length > 0) {
      if (this.opts.module === "commonjs") {
        const exports2 = this.exportedNames.map((n) => `  ${n}: ${n}`).join(",\n");
        parts.push(`module.exports = {
${exports2}
};`);
      } else if (this.opts.module === "esm") {
        const exports2 = this.exportedNames.join(", ");
        parts.push(`export { ${exports2} };`);
      }
    } else {
      if (this.opts.module === "commonjs") {
        if (bodyParts.some((p) => p.startsWith("function "))) {
          const funcNames = bodyParts.filter((p) => p.startsWith("function ")).map((p) => {
            const m = p.match(/^function\s+(\w+)/);
            return m ? m[1] : null;
          }).filter(Boolean);
          if (funcNames.length > 0) {
            const exportsStr = funcNames.map((n) => `  ${n}: ${n}`).join(",\n");
            parts.push(`module.exports = {
${exportsStr}
};`);
          }
        }
      }
    }
    const result = parts.join("\n");
    return this.opts.minify ? this.minify(result) : result;
  }
  genNode(node) {
    switch (node.kind) {
      case "literal":
        return this.genLiteral(node);
      case "template-string":
        return this.genTemplateString(node);
      case "variable":
        return this.genVariable(node);
      case "sexpr":
        return this.genSExpr(node);
      case "block":
        return this.genBlock(node);
      case "keyword":
        return this.genKeyword(node);
      case "try-block":
        return this.genTryBlock(node);
      default:
        return `/* unsupported: ${node.kind} */`;
    }
  }
  genLiteral(node) {
    if (node.type === "string") {
      return JSON.stringify(node.value);
    } else if (node.type === "boolean") {
      return node.value ? "true" : "false";
    } else if (node.type === "null") {
      return "null";
    } else if (node.type === "symbol") {
      if (node.value === "nil" || node.value === "null") {
        return "null";
      }
      const cleanName = String(node.value).replace(/^\$/, "");
      return flNameToJs(cleanName);
    } else {
      return String(node.value);
    }
  }
  genTemplateString(node) {
    const value = node.value;
    let jsCode = "`";
    let i = 0;
    while (i < value.length) {
      if (value[i] === "$" && value[i + 1] === "{") {
        const start = i + 2;
        const end = value.indexOf("}", start);
        if (end > start) {
          const expr = value.slice(start, end).trim();
          const jsExpr = this.genNode({ kind: "variable", name: expr });
          jsCode += "${" + jsExpr + "}";
          i = end + 1;
          continue;
        }
      }
      if (value[i] === "`") {
        jsCode += "\\`";
      } else if (value[i] === "\\") {
        jsCode += "\\\\";
      } else {
        jsCode += value[i];
      }
      i++;
    }
    jsCode += "`";
    return jsCode;
  }
  genVariable(node) {
    const cleanName = node.name.replace(/^\$/, "");
    return flNameToJs(cleanName);
  }
  genKeyword(node) {
    return JSON.stringify(node.name);
  }
  genSExpr(node) {
    const { op, args } = node;
    if (op === "and") {
      if (args.length === 0) return "true";
      return "(" + args.map((a) => this.genNode(a)).join(" && ") + ")";
    }
    if (op === "or") {
      if (args.length === 0) return "false";
      return "(" + args.map((a) => this.genNode(a)).join(" || ") + ")";
    }
    if (op === "cond") return this.genCond(args);
    if (op === "while") return this.genWhile(args);
    if (op === "->") {
      if (args.length === 0) return "null";
      let acc = this.genNode(args[0]);
      for (let i = 1; i < args.length; i++) {
        const step = args[i];
        if (step.kind === "sexpr") {
          const { op: fn, args: fnArgs } = step;
          const fnJs = flNameToJs(fn);
          const rest = fnArgs.map((a) => this.genNode(a));
          acc = `${fnJs}(${[acc, ...rest].join(", ")})`;
        } else {
          acc = `${this.genNode(step)}(${acc})`;
        }
      }
      return acc;
    }
    if (op === "->>") {
      if (args.length === 0) return "null";
      let acc = this.genNode(args[0]);
      for (let i = 1; i < args.length; i++) {
        const step = args[i];
        if (step.kind === "sexpr") {
          const { op: fn, args: fnArgs } = step;
          const fnJs = flNameToJs(fn);
          const rest = fnArgs.map((a) => this.genNode(a));
          acc = `${fnJs}(${[...rest, acc].join(", ")})`;
        } else {
          acc = `${this.genNode(step)}(${acc})`;
        }
      }
      return acc;
    }
    if (op === "recur") {
      const argStrs = args.map((a) => this.genNode(a));
      return `{ __recur: true, a: [${argStrs.join(", ")}] }`;
    }
    if (op === "loop") {
      const bindingsArg = args[0];
      const bodyExprs = args.slice(1);
      let items = [];
      if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
        items = bindingsArg.fields.get("items") || [];
      }
      const inits = [];
      const names = [];
      for (let i = 0; i < items.length; i += 2) {
        const nameNode = items[i];
        const valNode = items[i + 1];
        if (!nameNode) continue;
        const name = this.extractVarName(nameNode);
        const val = valNode ? this.genNode(valNode) : "null";
        const tmpName = `__fl_loop_${i}`;
        inits.push(`let ${tmpName} = ${val}; let ${name} = ${tmpName};`);
        names.push(name);
      }
      const bodyParts = bodyExprs.map((e) => this.genNode(e).trim()).filter((s) => s !== "");
      let bodyCode = "";
      if (bodyParts.length === 0) {
        bodyCode = "return null;";
      } else if (bodyParts.length === 1) {
        bodyCode = `return ${bodyParts[0]};`;
      } else {
        const stmts = bodyParts.slice(0, -1).map((s) => s.endsWith(";") ? s : s + ";");
        bodyCode = `${stmts.join(" ")} return ${bodyParts[bodyParts.length - 1]};`;
      }
      return `((() => { ${inits.join(" ")} while (true) { const __r = (() => { ${bodyCode} })(); if (__r && __r.__recur) { [${names.join(", ")}] = __r.a; continue; } return __r; } })())`;
    }
    if (op === "let") {
      if (args.length >= 2) {
        const bindingsArg = args[0];
        let bindings = [];
        if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
          bindings = bindingsArg.fields.get("items") || [];
        } else if (bindingsArg.kind === "sexpr") {
          bindings = bindingsArg.args;
        }
        const bindingStmts = [];
        const isNested = bindings.length > 0 && bindings[0].kind === "block" && bindings[0].type === "Array";
        if (isNested) {
          for (const binding of bindings) {
            if (binding.kind === "block" && binding.type === "Array") {
              const pairItems = binding.fields.get("items") || [];
              if (pairItems.length >= 2) {
                const varName = this.extractVarName(pairItems[0]);
                const value = this.genNode(pairItems[1]);
                bindingStmts.push(`let ${varName} = ${value};`);
              }
            }
          }
        } else {
          for (let i = 0; i < bindings.length; i += 2) {
            if (!bindings[i]) continue;
            const varName = this.extractVarName(bindings[i]);
            const value = bindings[i + 1] ? this.genNode(bindings[i + 1]) : "null";
            bindingStmts.push(`let ${varName} = ${value};`);
          }
        }
        const bodyParts = args.slice(1).map((a) => this.genNode(a).trim()).filter((s) => s !== "");
        let bodyCode = "";
        if (bodyParts.length === 0) {
          bodyCode = "return null;";
        } else if (bodyParts.length === 1) {
          bodyCode = `return ${bodyParts[0]};`;
        } else {
          const stmts = bodyParts.slice(0, -1).map((s) => s.endsWith(";") ? s : s + ";");
          bodyCode = `${stmts.join(" ")} return ${bodyParts[bodyParts.length - 1]};`;
        }
        return `((() => { ${bindingStmts.join(" ")} ${bodyCode} })())`;
      }
      return "(() => null)()";
    }
    if (op === "do") return this.genDo(args);
    const BINARY_OPS = {
      "+": "+",
      "-": "-",
      "*": "*",
      "/": "/",
      "%": "%",
      "<": "<",
      ">": ">",
      "<=": "<=",
      ">=": ">=",
      "==": "===",
      "!=": "!==",
      "=": "==="
    };
    if (op in BINARY_OPS && args.length === 2) {
      const left = this.genNode(args[0]);
      const right = this.genNode(args[1]);
      return `(${left} ${BINARY_OPS[op]} ${right})`;
    }
    if (op === "-" && args.length === 1) {
      return `(-${this.genNode(args[0])})`;
    }
    if (op === "not" && args.length === 1) {
      return `(!${this.genNode(args[0])})`;
    }
    if (op === "if") {
      const cond = this.genNode(args[0]);
      const thenExpr = this.genNode(args[1]);
      const elseExpr = args[2] ? this.genNode(args[2]) : "undefined";
      return `(${cond} ? ${thenExpr} : ${elseExpr})`;
    }
    if (op === "define") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `const ${varName} = ${value};`;
    }
    if (op === "set!") {
      const varName = this.extractVarName(args[0]);
      const value = this.genNode(args[1]);
      return `(${varName} = ${value})`;
    }
    if (op === "defn" || op === "defun") {
      const name = this.extractVarName(args[0]);
      const { params, preamble } = this.extractParamListWithDestructuring(args[1]);
      const bodyNode = args[2];
      const body = bodyNode ? this.genNode(bodyNode) : "null";
      const finalBody = preamble ? `((() => { ${preamble} return ${body}; })())` : body;
      return `const ${name} = (${params.join(", ")}) => ${finalBody}`;
    }
    if (op === "fn") return this.genFn(args);
    if (op === "list") {
      const elements = args.map((a) => this.genNode(a));
      return `[${elements.join(", ")}]`;
    }
    if (op === "str-concat") {
      const parts = args.map((a) => this.genNode(a));
      return `('' + ${parts.join(" + ")})`;
    }
    if (op === "print" || op === "println") {
      const arg = args.length > 0 ? this.genNode(args[0]) : '""';
      return `_fl_print(${arg})`;
    }
    if (op === "map") return `_fl_map(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
    if (op === "filter") return `_fl_filter(${this.genNode(args[1])}, ${this.genNode(args[0])})`;
    if (op === "reduce") return `_fl_reduce(${this.genNode(args[2])}, ${this.genNode(args[0])}, ${this.genNode(args[1])})`;
    if (op === "export") {
      for (const arg of args) {
        if (arg.kind === "variable") {
          this.exportedNames.push(arg.name);
        } else if (arg.kind === "literal" && typeof arg.value === "string") {
          this.exportedNames.push(arg.value);
        }
      }
      return "";
    }
    if (op === "let") {
      if (args.length >= 2) {
        const bindingsArg = args[0];
        let bindings = [];
        if (bindingsArg.kind === "block" && bindingsArg.type === "Array") {
          bindings = bindingsArg.fields.get("items") || [];
        } else if (bindingsArg.kind === "sexpr") {
          bindings = bindingsArg.args;
        }
        const bindingStmts = [];
        const isFlat = bindings.length > 0 && !(bindings[0].kind === "block" && bindings[0].type === "Array");
        if (isFlat) {
          for (let i = 0; i < bindings.length - 1; i += 2) {
            const varName2 = this.extractVarName(bindings[i]);
            const value2 = this.genNode(bindings[i + 1]);
            bindingStmts.push(`let ${varName2} = ${value2};`);
          }
        } else {
          for (const binding of bindings) {
            if (binding.kind === "block" && binding.type === "Array") {
              const pairItems = binding.fields.get("items") || [];
              if (pairItems.length >= 2) {
                const varName2 = this.extractVarName(pairItems[0]);
                const value2 = this.genNode(pairItems[1]);
                bindingStmts.push(`let ${varName2} = ${value2};`);
              }
            }
          }
        }
        const bodyStmts = args.slice(1).map((a) => this.genNode(a)).join("; ");
        return `(() => { ${bindingStmts.join(" ")} return ${bodyStmts}; })()`;
      }
      const varName = this.extractVarName(args[0]);
      const value = args[1] ? this.genNode(args[1]) : "undefined";
      return `(() => { let ${varName} = ${value}; return ${varName}; })()`;
    }
    return this.genFuncCall(op, args);
  }
  genDo(args) {
    if (args.length === 0) return "(() => undefined)()";
    if (args.length === 1) return `(() => ${this.genNode(args[0])})()`;
    const stmts = args.slice(0, -1).map((a) => {
      const c = this.genNode(a).trim();
      return c === "" || c.endsWith(";") ? c : c + ";";
    }).filter((s) => s !== "");
    const last = this.genNode(args[args.length - 1]);
    return `(() => { ${stmts.join(" ")} return ${last}; })()`;
  }
  genCond(args) {
    if (args.length === 0) return "null";
    let isNested = false;
    if (args[0].kind === "block" && args[0].type === "Array") {
      const items = args[0].fields.get("items");
      if (Array.isArray(items) && items.length >= 1) {
        isNested = true;
      }
    }
    let pairs;
    if (isNested) {
      pairs = args.map((arg) => {
        if (arg.kind === "block" && arg.type === "Array") {
          const items = arg.fields.get("items") || [];
          return [items[0], items[1]];
        }
        return [arg, null];
      });
    } else {
      pairs = [];
      for (let i = 0; i < args.length - 1; i += 2) {
        pairs.push([args[i], args[i + 1]]);
      }
      if (args.length % 2 === 1) {
        pairs.push([{ kind: "literal", type: "boolean", value: true }, args[args.length - 1]]);
      }
    }
    let res = "null";
    for (let i = pairs.length - 1; i >= 0; i--) {
      const [testNode, bodyNode] = pairs[i];
      if (!testNode) continue;
      const test = this.genNode(testNode);
      const body = bodyNode ? this.genNode(bodyNode) : "null";
      res = "(" + test + " ? " + body + " : " + res + ")";
    }
    return res;
  }
  genWhile(args) {
    const cond = this.genNode(args[0]);
    const bodyParts = args.slice(1).map((a) => this.genNode(a).trim()).filter((s) => s !== "");
    const bodyCode = bodyParts.map((s) => s.endsWith(";") ? s : s + ";").join(" ");
    return "(() => { while(" + cond + ") { " + bodyCode + " } })()";
  }
  genFn(args) {
    const { params, preamble } = this.extractParamListWithDestructuring(args[0]);
    let body;
    if (args.length <= 1) {
      body = "undefined";
    } else if (args.length === 2) {
      body = this.genNode(args[1]);
    } else {
      const bodyNodes = args.slice(1);
      const stmts = bodyNodes.slice(0, -1).map((n) => this.genNode(n) + ";").join(" ");
      const last = this.genNode(bodyNodes[bodyNodes.length - 1]);
      body = `((() => { ${stmts} return ${last}; })())`;
    }
    const finalBody = preamble ? `((() => { ${preamble} return ${body}; })())` : body;
    return `((${params.join(", ")}) => ${finalBody})`;
  }
  extractParamListWithDestructuring(node) {
    if (!node) return { params: [], preamble: "" };
    let pNodes = node.kind === "block" && node.type === "Array" ? node.fields.get("items") : node.kind === "sexpr" ? node.args : [node];
    const params = [];
    const bindingStmts = [];
    let tmpCount = 0;
    for (const p of pNodes || []) {
      if (p.kind === "variable") {
        params.push(flNameToJs(p.name.replace(/^\$/, "")));
      } else if (p.kind === "literal" && (p.type === "symbol" || typeof p.value === "string")) {
        params.push(flNameToJs(String(p.value).replace(/^\$/, "")));
      } else if (p.kind === "block" && p.type === "Array") {
        const tmpName = `_arg${tmpCount++}`;
        params.push(tmpName);
        const subItems = p.fields.get("items") || [];
        for (let i = 0; i < subItems.length; i++) {
          const sub = subItems[i];
          if (sub.kind === "variable") {
            const varName = flNameToJs(sub.name.replace(/^\$/, ""));
            bindingStmts.push(`let ${varName} = ${tmpName}[${i}];`);
          } else if (sub.kind === "literal" && (sub.type === "symbol" || typeof sub.value === "string")) {
            const varName = flNameToJs(String(sub.value).replace(/^\$/, ""));
            bindingStmts.push(`let ${varName} = ${tmpName}[${i}];`);
          }
        }
      } else {
        params.push("p");
      }
    }
    return { params, preamble: bindingStmts.join(" ") };
  }
  extractVarName(node) {
    if (node.kind === "variable") return flNameToJs(node.name.replace(/^\$/, ""));
    if (node.kind === "literal" && typeof node.value === "string") return flNameToJs(node.value);
    return "unknown";
  }
  extractParamList(node) {
    if (!node) return [];
    let pNodes = node.kind === "block" && node.type === "Array" ? node.fields.get("items") : node.kind === "sexpr" ? node.args : [node];
    return (pNodes || []).map((p) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map((n) => flNameToJs(n));
  }
  extractBlockParams(node) {
    const params = node.fields.get("params");
    if (!params) return [];
    let pNodes = Array.isArray(params) ? params : params.kind === "block" && params.type === "Array" ? params.fields.get("items") : [params];
    return (pNodes || []).map((p) => (p.name || String(p.value || "p")).replace(/^\\$/, "")).map((n) => flNameToJs(n));
  }
  genFuncCall(op, args) {
    const argStrs = args.map((a) => this.genNode(a));
    const jsOp = flNameToJs(op);
    return `${jsOp}(${argStrs.join(", ")})`;
  }
  genBlock(node) {
    switch (node.type) {
      case "FUNC":
        return this.genFuncBlock(node);
      case "MODULE":
        return this.genModuleBlock(node);
      case "SERVICE":
        return this.genServiceBlock(node);
      case "MODEL":
        return this.genModelBlock(node);
      case "CONTROLLER":
        return this.genControllerBlock(node);
      case "MAP":
      case "Map":
        return this.genMapBlock(node);
      case "ARRAY":
      case "Array":
        return this.genArrayBlock(node);
      default:
        return `/* unsupported block: ${node.type} */`;
    }
  }
  genMapBlock(node) {
    const pairs = [];
    node.fields.forEach((val, key) => {
      const jsKey = key.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/) ? key : JSON.stringify(key);
      pairs.push(jsKey + ": " + this.genNode(val));
    });
    return "({ " + pairs.join(", ") + " })";
  }
  genArrayBlock(node) {
    const items = node.fields.get("items");
    let pNodes = Array.isArray(items) ? items : items && items.kind === "block" ? items.fields.get("items") : [];
    const elements = (pNodes || []).map((a) => this.genNode(a));
    return "[" + elements.join(", ") + "]";
  }
  genFuncBlock(node) {
    const params = this.extractBlockParams(node);
    const body = node.fields.get("body");
    const bodyCode = body ? this.genNode(body) : "undefined";
    const jsName = this.flNameToJs(node.name);
    return `function ${jsName}(${params.join(", ")}) { return ${bodyCode}; }`;
  }
  flNameToJs(name) {
    return flNameToJs(name);
  }
  genModuleBlock(node) {
    const body = node.fields.get("body");
    if (!body) return "";
    if (Array.isArray(body)) return body.map((n) => this.genNode(n)).join("\n");
    return this.genNode(body);
  }
  genServiceBlock(node) {
    const name = node.name;
    const methods = node.fields.get("methods");
    const inject = node.fields.get("inject");
    const injectParams = inject ? Array.isArray(inject) ? inject.map((dep) => `private ${dep.name || dep}: ${dep.name || dep}`).join(", ") : "" : "";
    let methodsCode = "";
    if (methods && methods.kind === "sexpr") {
      methodsCode = methods.args.map((arg) => {
        if (arg.kind === "sexpr" && arg.op === "fn") {
          const fnExpr = arg;
          const fnName = fnExpr.args[0].name || fnExpr.args[0].value || "method";
          const fnParams = this.extractParamList(fnExpr.args[1]).map((p) => p.replace(/^\$/, "")).join(", ");
          const fnBody = fnExpr.args[2] ? this.genNode(fnExpr.args[2]) : "undefined";
          return `  ${fnName}(${fnParams}) { return ${fnBody}; }`;
        }
        return "";
      }).filter(Boolean).join("\n");
    }
    return [`export class ${name} {`, injectParams ? `  constructor(${injectParams}) {}` : `  constructor() {}`, methodsCode, `}`].join("\n");
  }
  genModelBlock(node) {
    const name = node.name;
    const table = node.fields.get("table") || name.toLowerCase() + "s";
    const fields = node.fields.get("fields");
    let sqlColumns = "  id SERIAL PRIMARY KEY";
    if (fields && fields.kind === "sexpr") {
      for (const arg of fields.args) {
        if (arg.kind === "sexpr") {
          const fName = arg.op.replace(/^[\$:]/, "").replace(/-/g, "_");
          sqlColumns += `,
  ${fName} VARCHAR(255)`;
        }
      }
    }
    return [`CREATE TABLE IF NOT EXISTS ${table} (`, sqlColumns, `,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);`].join("\n");
  }
  genControllerBlock(node) {
    const prefix = node.fields.get("prefix") || "/";
    const routes = node.fields.get("routes");
    let routeCode = "";
    if (routes && routes.kind === "sexpr") {
      const sExpr = routes;
      for (let i = 0; i < sExpr.args.length; i += 3) {
        const method = String(sExpr.args[i].value || "GET").toLowerCase();
        const route = String(sExpr.args[i + 1].value || "/");
        routeCode += `router.${method}("${prefix === "/" ? route : prefix + route}", async (req, res) => { res.json({ status: 200 }); });
`;
      }
    }
    return [`import { Router } from "express";`, `export const router = Router();`, routeCode].join("\n");
  }
  genTryBlock(node) {
    const body = this.genNode(node.body);
    const parts = [`(()=>{try{return ${body};}`];
    if (node.catchClauses) {
      for (const cc of node.catchClauses) {
        parts.push(`catch(${cc.variable || "err"}){return ${this.genNode(cc.handler)};}`);
      }
    }
    if (node.finallyBlock) parts.push(`finally{${this.genNode(node.finallyBlock)};}`);
    return parts.join("") + "})()";
  }
  minify(code) {
    return code.replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
  }
};

// src/stdlib-compile.ts
function createCompileModule() {
  const cg = new JSCodegen();
  return {
    // fl_compile_file(inputPath, outputPath) → boolean
    // Compile a single .fl file to JavaScript
    "fl_compile_file": (inputPath, outputPath) => {
      try {
        const source = fs.readFileSync(inputPath, "utf-8");
        const tokens = lex(source);
        const ast = parse(tokens);
        const js = cg.generate(ast, {
          module: "commonjs",
          runtime: false,
          minify: false,
          target: "node"
        });
        const dir = path.dirname(outputPath);
        if (dir !== "." && !fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(outputPath, js, "utf-8");
        return true;
      } catch (err) {
        throw new Error(`fl_compile_file failed for '${inputPath}': ${err.message}`);
      }
    },
    // fl_compile(srcDir, distDir) → { compiled: number, failed: number, errors: string[] }
    // Compile all .fl files in a directory
    "fl_compile": (srcDir, distDir) => {
      try {
        const absDir = path.resolve(srcDir);
        const absOut = path.resolve(distDir);
        const files = fs.readdirSync(absDir).filter((f) => f.endsWith(".fl")).map((f) => path.join(absDir, f));
        let compiled = 0;
        let failed = 0;
        const errors = [];
        for (const file of files) {
          const outFile = path.join(absOut, path.basename(file, ".fl") + ".js");
          try {
            const source = fs.readFileSync(file, "utf-8");
            const tokens = lex(source);
            const ast = parse(tokens);
            const js = cg.generate(ast, {
              module: "commonjs",
              runtime: false,
              minify: false,
              target: "node"
            });
            const dir = path.dirname(outFile);
            if (dir !== "." && !fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(outFile, js, "utf-8");
            compiled++;
          } catch (err) {
            failed++;
            errors.push(`${path.basename(file)}: ${err.message}`);
          }
        }
        return { compiled, failed, errors };
      } catch (err) {
        throw new Error(`fl_compile failed for '${srcDir}': ${err.message}`);
      }
    },
    // fl_compile_result_ok(result) → boolean
    // Check if compilation result is successful (no failures)
    "fl_compile_result_ok": (result) => {
      return result.failed === 0;
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCompileModule
});
