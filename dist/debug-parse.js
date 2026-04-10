"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const parser_1 = require("./parser");
const interpreter_1 = require("./interpreter");
const fs = __importStar(require("fs"));
function loadFile(interp, path) {
    const src = fs.readFileSync(path, "utf-8");
    const tokens = (0, lexer_1.lex)(src);
    const ast = (0, parser_1.parse)(tokens);
    interp.interpret(ast);
}
const interp = new interpreter_1.Interpreter();
try {
    loadFile(interp, "./src/freelang-lexer.fl");
    loadFile(interp, "./src/freelang-parser.fl");
    loadFile(interp, "./src/freelang-codegen.fl");
    console.log("All FL files loaded. Functions: lex:", interp.context.functions.has("lex"), "parse:", interp.context.functions.has("parse"), "gen-js:", interp.context.functions.has("gen-js"));
    // Test lex
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`(lex "42")`)));
    const lexResult = interp.context.lastValue;
    console.log("lex('42'):", JSON.stringify(lexResult));
    // Test parse
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`(parse (lex "42"))`)));
    const parseResult = interp.context.lastValue;
    console.log("parse(lex('42')):", JSON.stringify(parseResult));
    // Test gen-js on a FUNC block
    const flSrc = `[FUNC add :params [$a $b] :body ((+ $a $b))]`;
    interp.interpret((0, parser_1.parse)((0, lexer_1.lex)(`(gen-js (parse (lex ${JSON.stringify(flSrc)})))`)));
    console.log("gen-js result:\n", interp.context.lastValue);
}
catch (e) {
    console.error("Error:", e.message);
    if (e.stack)
        console.error("Stack:", e.stack.split("\n").slice(0, 5).join("\n"));
}
//# sourceMappingURL=debug-parse.js.map