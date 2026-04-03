// FreeLang v9: Lexer Test
// 간단한 v9 코드를 렉싱하여 토큰을 출력

import * as fs from 'fs';
import { lex } from './lexer';

const code = fs.readFileSync('./examples/simple-intent.fl', 'utf-8');

console.log('📝 FreeLang v9 Self-Compile Test\n');
console.log('═══════════════════════════════════\n');
console.log('소스 코드:');
console.log('───────────────────────────────────');
console.log(code);
console.log('───────────────────────────────────\n');

try {
  const tokens = lex(code);

  console.log(`✅ 렉싱 완료: ${tokens.length}개 토큰\n`);
  console.log('토큰 목록:');
  console.log('───────────────────────────────────');

  let lineCount = 1;
  tokens.forEach((token, idx) => {
    if (token.line > lineCount) {
      console.log('');
      lineCount = token.line;
    }

    const paddedType = token.type.padEnd(12);
    const paddedValue = `"${token.value}"`.padEnd(20);
    console.log(`  ${idx.toString().padStart(3)}: [${paddedType}] ${paddedValue} (line ${token.line}, col ${token.col})`);
  });

  console.log('\n───────────────────────────────────');
  console.log('\n📊 토큰 통계:');
  console.log('───────────────────────────────────');

  const stats: Record<string, number> = {};
  tokens.forEach(t => {
    stats[t.type] = (stats[t.type] || 0) + 1;
  });

  Object.entries(stats).forEach(([type, count]) => {
    console.log(`  ${type.padEnd(12)}: ${count.toString().padStart(3)}개`);
  });

  console.log('\n═══════════════════════════════════');
  console.log('✅ 렉싱 성공 - FreeLang v9 코드 파싱 완료!\n');

} catch (error) {
  console.error('❌ 렉싱 오류:');
  console.error((error as Error).message);
  process.exit(1);
}
