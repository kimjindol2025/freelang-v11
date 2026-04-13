import { lex } from './lexer';
import { parse } from './parser';

// map literal은 let 바인딩 안에서만 사용 가능
const code = `(let [[$m {:kind "closure" :params ["a"] :val 42}]] $m)`;
const ast = parse(lex(code));
const node = ast[0] as any;
// 바인딩의 val node 찾기
const bindingsBlock = node.args[0];
const pairs = bindingsBlock.fields instanceof Map ? bindingsBlock.fields.get("items") : [];
const pair = pairs[0];
const pairItems = pair.fields instanceof Map ? pair.fields.get("items") : [];
const mapNode = pairItems[1]; // {:kind "closure" ...}
console.log("mapNode type:", mapNode.type, "fields instanceof Map:", mapNode.fields instanceof Map);
if (mapNode.fields instanceof Map) {
  console.log("fields keys:", [...mapNode.fields.keys()]);
  for (const [k, v] of mapNode.fields) {
    console.log(` key: ${k}`, "val:", JSON.stringify(v)?.slice(0, 80));
  }
}
