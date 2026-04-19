// Load compiler-L3-FINAL.js as module
const fs = require('fs');
const code = fs.readFileSync('compiler-L3-FINAL.js', 'utf8');
eval(code);

// Read hello.fl
const source = fs.readFileSync('self/bench/hello.fl', 'utf8');
console.log("=== SOURCE ===");
console.log(source);

console.log("\n=== LEX RESULT ===");
const tokens = lex(source);
console.log(JSON.stringify(tokens, null, 2));
