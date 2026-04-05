const { lex } = require('./dist/lexer');
const { parse } = require('./dist/parser');

const code = `[FUNC test :body (identity[int] 42)]`;

try {
  const tokens = lex(code);
  const blocks = parse(tokens);
  console.log("Block object:");
  const block = blocks[0];
  console.log("  kind:", block.kind);
  console.log("  type:", block.type);
  console.log("  name:", block.name);
  console.log("  fields is Map:", block.fields instanceof Map);
  console.log("  fields.size:", block.fields.size);
  console.log("  fields entries:", Array.from(block.fields.entries()));
  
  if (block.fields.has("body")) {
    const body = block.fields.get("body");
    console.log("  body:", JSON.stringify(body, null, 2));
  }
} catch (e) {
  console.error("Error:", e.message);
}
