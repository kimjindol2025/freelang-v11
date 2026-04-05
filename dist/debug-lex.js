"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lexer_1 = require("./lexer");
const code = `[MODULE math :exports [add] :body []]`;
const tokens = (0, lexer_1.lex)(code);
tokens.forEach((t, i) => {
    console.log(`${i}: ${t.type} = "${t.value}"`);
});
//# sourceMappingURL=debug-lex.js.map