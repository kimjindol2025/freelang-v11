// Inspect v12-candidate internals
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../../bootstrap-v12-candidate.js', 'utf8');
// Strip out the driver that auto-runs on argv:
const driverless = src.replace(/\(\(__argv__==null\)\?null:[\s\S]*$/m, '');
// Inject exports at end
const injected = driverless + `\nmodule.exports = { lex, parse, cg, cg_func_block, extract_params, extract_name, param_loop };`;
fs.writeFileSync(__dirname + '/_v12_inspect_mod.js', injected);

const mod = require('./_v12_inspect_mod.js');
const { lex, parse, cg, cg_func_block, extract_params, extract_name, param_loop } = mod;

const code = '[FUNC double :params [$x] :body (* $x 2)]';
const toks = lex(code);
console.log('TOKS:', toks.length);
const ast = parse(toks);
console.log('AST:', JSON.stringify(ast, null, 2));
console.log('---');
const fnode = ast[0];
console.log('CG-FUNC:', cg_func_block(fnode));
console.log('---');
const pnode = fnode.fields.params;
const pitems = pnode.fields.items;
console.log('pitems:', JSON.stringify(pitems, null, 2));
console.log('extract-params:', extract_params(pitems));
console.log('extract-name(item[0]):', extract_name(pitems[0]));
