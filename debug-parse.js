const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');

const code = `[FUNC test
  :body (identity[int] 42)
]`;

try {
  const tokens = lex(code);
  console.log("Tokens:");
  tokens.forEach(t => {
    if (t.type !== 'EOF') {
      console.log(`  ${t.type}: ${JSON.stringify(t.value)}`);
    }
  });
  
  const blocks = parse(tokens);
  console.log("\nParsed blocks:");
  blocks.forEach(b => {
    if (b.kind === 'block') {
      console.log(`Block: ${b.type} ${b.name}`);
      console.log(`  Fields: ${JSON.stringify(Array.from(b.fields.entries()))}`);
    }
  });
} catch (e) {
  console.error("Error:", e.message);
  console.error("Stack:", e.stack);
}
