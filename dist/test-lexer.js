"use strict";
// FreeLang v9: Lexer Test
// 간단한 v9 코드를 렉싱하여 토큰을 출력
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const lexer_1 = require("./lexer");
const code = fs.readFileSync('./examples/simple-intent.fl', 'utf-8');
console.log('📝 FreeLang v9 Self-Compile Test\n');
console.log('═══════════════════════════════════\n');
console.log('소스 코드:');
console.log('───────────────────────────────────');
console.log(code);
console.log('───────────────────────────────────\n');
try {
    const tokens = (0, lexer_1.lex)(code);
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
    const stats = {};
    tokens.forEach(t => {
        stats[t.type] = (stats[t.type] || 0) + 1;
    });
    Object.entries(stats).forEach(([type, count]) => {
        console.log(`  ${type.padEnd(12)}: ${count.toString().padStart(3)}개`);
    });
    console.log('\n═══════════════════════════════════');
    console.log('✅ 렉싱 성공 - FreeLang v9 코드 파싱 완료!\n');
}
catch (error) {
    console.error('❌ 렉싱 오류:');
    console.error(error.message);
    process.exit(1);
}
//# sourceMappingURL=test-lexer.js.map