const { lex } = require('./dist/lexer');

const code = `:body $x`;
const tokens = lex(code);
console.log("Tokens:");
tokens.forEach(t => {
  if (t.type !== 'EOF') {
    console.log(`  ${t.type}: ${JSON.stringify(t.value)}`);
  }
});
