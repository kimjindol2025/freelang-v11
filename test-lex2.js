const { lex } = require('./dist/lexer');

const code = `:body (identity[int] 42)`;
const tokens = lex(code);
console.log("Tokens:");
tokens.forEach(t => {
  if (t.type !== 'EOF') {
    console.log(`  ${t.type}: ${JSON.stringify(t.value)}`);
  }
});
