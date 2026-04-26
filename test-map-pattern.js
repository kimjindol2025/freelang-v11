const { Interpreter } = require('./dist/interpreter.js');
const { Lexer } = require('./dist/lexer.js');
const { Parser } = require('./dist/parser.js');

const code = `
(match {:status "ok" :data 42}
  ([{:status "ok"} "매칭됨"]
   [_ "매칭 안됨"]))
`;

const lexer = new Lexer(code);
const tokens = lexer.lex();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log("✓ AST 파싱 성공");

const interp = new Interpreter();
try {
  const result = interp.eval(ast[0]);
  console.log("✓ 결과:", result);
} catch (err) {
  console.log("✗ 에러:", err.message.substring(0, 200));
}
