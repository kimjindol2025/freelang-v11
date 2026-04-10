import { lex } from "./lexer";
import { parse } from "./parser";

// Direct test of [[a b]] in argument position
const tests = [
  `(f [[$a]])`,           // 1 element inner
  `(f [[$a $b]])`,        // 2 elements inner - fails?
  `(f [[$a $b $c]])`,     // 3 elements
  `(f [[$a]] [[$b]])`,    // two separate 1-element outer arrays
];

for (let i = 0; i < tests.length; i++) {
  try {
    const tokens = lex(tests[i]);
    console.log(`test${i+1} tokens:`, tokens.map(t => `${t.type}(${t.value})`).join(' '));
    parse(tokens);
    console.log(`test${i+1}: OK`);
  } catch(e: any) { console.log(`test${i+1}: ERROR: ${e.message}`); }
}
