const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');
const { Interpreter } = require('./dist/interpreter');

const genericsCode = `[FUNC identity
  :generics [T]
  :params [[x T]]
  :return T
  :body x
]`;

const tokens = lex(genericsCode);
const blocks = parse(tokens);

const interpreter = new Interpreter();
interpreter.interpret(blocks);

const context = interpreter.getContext();
console.log("Functions registered:", Array.from(context.functions.keys()));

// Now try to call it
const testCode = `[FUNC test :body (identity[int] 42)]`;
const testTokens = lex(testCode);
const testBlocks = parse(testTokens);

console.log("\nTest tokens for (identity[int] 42):");
testTokens.filter(t => t.type !== 'EOF').forEach(t => {
  console.log(`  ${t.type}: ${JSON.stringify(t.value)}`);
});

console.log("\nTest blocks:");
console.log(JSON.stringify(testBlocks, null, 2));
