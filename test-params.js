const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');
const { Interpreter } = require('./dist/interpreter');

const code = `[FUNC identity
  :generics [T]
  :params [[x T]]
  :return T
  :body x
]`;

const tokens = lex(code);
const blocks = parse(tokens);
const interpreter = new Interpreter();
interpreter.interpret(blocks);

const func = interpreter.getContext().functions.get("identity");
console.log("Function details:");
console.log("  params:", func.params);
console.log("  generics:", func.generics);
console.log("  body:", JSON.stringify(func.body, null, 2));
