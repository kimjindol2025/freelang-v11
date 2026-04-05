const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');
const { Interpreter } = require('./dist/interpreter');

// First, load the generic function
const genericsCode = `[FUNC identity
  :generics [T]
  :params [[x T]]
  :return T
  :body x
]`;

const tokens1 = lex(genericsCode);
const blocks1 = parse(tokens1);
const interpreter = new Interpreter();
interpreter.interpret(blocks1);

console.log("Loaded functions:", Array.from(interpreter.getContext().functions.keys()));

// Now load the test function
const testCode = `[FUNC test :body (identity[int] 42)]`;
const tokens2 = lex(testCode);
const blocks2 = parse(tokens2);

try {
  interpreter.interpret(blocks2);
  console.log("Functions after test:", Array.from(interpreter.getContext().functions.keys()));
  
  const testFunc = interpreter.getContext().functions.get("test");
  if (testFunc) {
    console.log("\nTest function body:", JSON.stringify(testFunc.body, null, 2));
    
    // Try to evaluate the body
    const result = (interpreter).eval(testFunc.body);
    console.log("Result:", result);
  }
} catch (e) {
  console.error("Error:", e.message);
  console.error("Stack:", e.stack.split('\n').slice(0, 10).join('\n'));
}
