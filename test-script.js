const { compileScript } = require('./dist/script-compiler.js');

const code = `
func greet(name) {
  return name
}
`;

try {
  const result = compileScript(code);
  console.log("✅ 컴파일 성공:");
  console.log(result);
} catch (e) {
  console.error("❌ 컴파일 실패:", e.message);
}
