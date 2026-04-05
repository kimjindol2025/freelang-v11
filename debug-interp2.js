const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');
const { Interpreter } = require('./dist/interpreter');
const fs = require('fs');

// Load from file
const genericsCode = fs.readFileSync('examples/stdlib-generics.fl', 'utf-8');

const tokens1 = lex(genericsCode);
const blocks1 = parse(tokens1);
const interpreter = new Interpreter();
interpreter.interpret(blocks1);

console.log("Loaded functions:", Array.from(interpreter.getContext().functions.keys()));

const identityFunc = interpreter.getContext().functions.get("identity");
console.log("\nidentity function:");
console.log("  params:", identityFunc.params);
console.log("  generics:", identityFunc.generics);
console.log("  body:", JSON.stringify(identityFunc.body, null, 2));

// Now test
const testCode = `[FUNC test :body (identity[int] 42)]`;
const tokens2 = lex(testCode);
const blocks2 = parse(tokens2);

try {
  interpreter.interpret(blocks2);
  
  const testFunc = interpreter.getContext().functions.get("test");
  if (testFunc) {
    console.log("\nTest function body:", JSON.stringify(testFunc.body, null, 2));
    
    const result = interpreter.eval(testFunc.body);
    console.log("Result:", result);
  }
} catch (e) {
  console.error("Error:", e.message);
}
