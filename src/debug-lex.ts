import { lex } from "./lexer";

const code = `[MODULE math :exports [add] :body []]`;
const tokens = lex(code);

tokens.forEach((t, i) => {
  console.log(`${i}: ${t.type} = "${t.value}"`);
});
