#!/usr/bin/env node
/**
 * FreeLang v11.7.11 코딩 규칙 11조 린터
 * P0 5조 + P1 6조 자동 검증
 *
 * 사용: node lint-11clauses.js app/server.fl
 *      또는: freelang-lint app/server.fl (설치 후)
 */

const fs = require('fs');
const path = require('path');

const RULES = {
  P0: [
    {
      id: '1',
      name: '$ 파라미터 강제',
      desc: 'defn 파라미터는 반드시 $로 시작',
      check: (content) => {
        const issues = [];
        // (defn name [a b] 패턴 찾기 ($ 없는 파라미터)
        const defnRegex = /\(defn\s+(\w+)\s*\[((?:[^\[\]]*?))\]/g;
        let match;
        let lineNum = 1;
        let lastPos = 0;

        while ((match = defnRegex.exec(content)) !== null) {
          const params = match[2];
          // 파라미터가 있고, $로 시작하지 않는 경우
          if (params.trim() && !params.includes('$')) {
            lineNum = content.substring(0, match.index).split('\n').length;
            issues.push({
              line: lineNum,
              col: match.index,
              code: `(defn ${match[1]} [${params}]`,
              fix: `(defn ${match[1]} [${params.replace(/\b(\w+)/g, '$$1')}]`
            });
          }
        }
        return issues;
      }
    },
    {
      id: '2',
      name: 'try-catch 정확한 문법',
      desc: 'try 블록은 (catch varname ...) 형식만 사용',
      check: (content) => {
        const issues = [];
        // (try ... (fn ... 패턴 찾기 (fn = lambda)
        const badTryRegex = /\(try\s+[^\)]+\s*\(fn\s/g;
        let match;
        while ((match = badTryRegex.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            line: lineNum,
            col: match.index,
            code: match[0],
            fix: '(try ... (catch varname ...) 형식 사용'
          });
        }
        return issues;
      }
    },
    {
      id: '3',
      name: 'Bearer 토큰: http-get-bearer 필수',
      desc: 'Authorization Bearer는 http-get-bearer 함수 사용',
      check: (content) => {
        const issues = [];
        // Authorization 헤더를 직접 설정하는 패턴
        const badAuthRegex = /\(http-get\s+\w+\s+\{\s*"Authorization"/g;
        let match;
        while ((match = badAuthRegex.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            line: lineNum,
            col: match.index,
            code: match[0],
            fix: '(http-get-bearer url token) 사용'
          });
        }
        return issues;
      }
    },
    {
      id: '4',
      name: 'let 바인딩: 각 줄 하나씩',
      desc: 'let 벡터 내 바인딩은 한 줄에 하나씩만',
      check: (content) => {
        const issues = [];
        // (let [...] 가 같은 줄에 열리고 닫히는 경우만 체크
        // 괄호 깊이를 고려해 최상위 토큰 수가 4개 이상(2쌍)이면 위반
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const m = line.match(/\(let\s*\[([^\]]+)\]/);
          if (!m) return;
          const inner = m[1];
          let depth = 0, tokens = 0, inToken = false;
          for (const c of inner) {
            if ('([{'.includes(c)) { depth++; inToken = true; }
            else if (')]}'.includes(c)) { depth--; }
            else if (/\s/.test(c)) {
              if (depth === 0 && inToken) { tokens++; inToken = false; }
            } else {
              inToken = true;
            }
          }
          if (inToken) tokens++;
          if (tokens >= 4) {
            issues.push({
              line: idx + 1,
              col: 0,
              code: line.trim(),
              fix: '각 바인딩을 새 줄에 배치: (let [x 1\\n      y 2]'
            });
          }
        });
        return issues;
      }
    },
    {
      id: '5',
      name: '문자열 보간: 객체는 json-stringify 필수',
      desc: 'str 함수에 map/객체 직접 전달 금지',
      check: (content) => {
        const issues = [];
        // (str ... {...} 패턴 (json-stringify 없음)
        const badStrRegex = /\(str\s+[^)]*\{\s*[a-zA-Z_$]/g;
        let match;
        while ((match = badStrRegex.exec(content)) !== null) {
          // json-stringify로 감싸있는지 확인
          const section = content.substring(match.index, match.index + 100);
          if (!section.includes('json-stringify')) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            issues.push({
              line: lineNum,
              col: match.index,
              code: match[0],
              fix: '(str ... (json-stringify {...}) 형식 사용'
            });
          }
        }
        return issues;
      }
    }
  ],

  P1: [
    {
      id: '6',
      name: 'DB 경로: 절대경로만',
      desc: '상대경로(./data) 금지, 절대경로(/home/...) 필수',
      check: (content) => {
        const issues = [];
        // "./data" 패턴 찾기
        const badPathRegex = /"\.\/[^"]*"/g;
        let match;
        while ((match = badPathRegex.exec(content)) !== null) {
          // db-query, file-read, file-write 근처인지 확인
          const before = content.substring(Math.max(0, match.index - 50), match.index);
          if (/(db-query|file-read|file-write|:path)/.test(before)) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            issues.push({
              line: lineNum,
              col: match.index,
              code: match[0],
              fix: `상대경로 대신 절대경로 사용: "/home/kimjin/..."`
            });
          }
        }
        return issues;
      }
    },
    {
      id: '7',
      name: 'HTTP 응답: .body 파싱 필수',
      desc: 'http-get 응답의 .body는 문자열이므로 json-parse 필수',
      check: (content) => {
        const issues = [];
        // (http-get ...) 호출 직후 get response "body" 검사
        // 단순 휴리스틱: http-get 호출 후 즉시 json-parse 체크
        const httpRegex = /\(http-get[^)]*\)[^)]*\(get\s+\w+\s+"body"\)/g;
        let match;
        while ((match = httpRegex.exec(content)) !== null) {
          // json-parse로 감싸있는지 확인
          const section = content.substring(match.index, match.index + 150);
          if (!section.includes('json-parse')) {
            const lineNum = content.substring(0, match.index).split('\n').length;
            issues.push({
              line: lineNum,
              col: match.index,
              code: match[0],
              fix: '(json-parse (get response "body")) 형식 필수'
            });
          }
        }
        return issues;
      }
    },
    {
      id: '8',
      name: '라우트 params: req 구조 먼저 확인',
      desc: 'params 구조가 불명확하면 println으로 먼저 확인',
      check: (content) => {
        // 이 규칙은 자동화 어려움 - 스타일 권고사항만
        return [];
      }
    },
    {
      id: '9',
      name: 'nil 전파 방지',
      desc: 'nil이 나올 수 있는 경우 항상 기본값 제공',
      check: (content) => {
        const issues = [];
        // (get obj key) 패턴 (기본값 없음)
        const getRegex = /\(get\s+(\w+)\s+"([^"]+)"\)(?!\s+\[)(?!\s+{})/g;
        let match;
        let count = 0;
        while ((match = getRegex.exec(content)) !== null && count < 5) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            line: lineNum,
            col: match.index,
            code: match[0],
            fix: `(get ${match[1]} "${match[2]}" default-value) 기본값 추가 권장`,
            severity: 'warning'
          });
          count++;
        }
        return issues;
      }
    },
    {
      id: '10',
      name: '중첩 if 피하기',
      desc: '3단계 이상 중첩 if는 cond 사용',
      check: (content) => {
        const issues = [];
        // (if ... (if ... (if 패턴 찾기
        const nestedIfRegex = /\(if\s+[^)]*\(if\s+[^)]*\(if/g;
        let match;
        while ((match = nestedIfRegex.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length;
          issues.push({
            line: lineNum,
            col: match.index,
            code: '(if ... (if ... (if ...',
            fix: '(cond [...] [...] ...) 사용 권장',
            severity: 'warning'
          });
        }
        return issues;
      }
    },
    {
      id: '11',
      name: 'URL 파라미터: 디코딩 필수',
      desc: 'URL에서 추출한 문자열은 decodeURIComponent 필수',
      check: (content) => {
        // 복잡한 검사이므로 생략 (대부분 port-registry 등에서 처리됨)
        return [];
      }
    }
  ]
};

function lintFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 파일을 찾을 수 없음: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const allIssues = [];

  // P0 규칙 검사
  for (const rule of RULES.P0) {
    const issues = rule.check(content);
    issues.forEach(issue => {
      allIssues.push({ ...issue, ruleId: rule.id, ruleName: rule.name, severity: 'ERROR' });
    });
  }

  // P1 규칙 검사
  for (const rule of RULES.P1) {
    const issues = rule.check(content);
    issues.forEach(issue => {
      allIssues.push({ ...issue, ruleId: rule.id, ruleName: rule.name, severity: issue.severity || 'WARNING' });
    });
  }

  // 정렬
  allIssues.sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    if (a.severity !== b.severity) return a.severity === 'ERROR' ? -1 : 1;
    return a.ruleId - b.ruleId;
  });

  // 출력
  console.log(`\n📋 ${path.basename(filePath)} 린팅 결과\n`);

  if (allIssues.length === 0) {
    console.log('✅ 규칙 위반 없음!\n');
    return;
  }

  const errorCount = allIssues.filter(i => i.severity === 'ERROR').length;
  const warningCount = allIssues.filter(i => i.severity === 'WARNING').length;

  console.log(`🔴 ERROR: ${errorCount}개  |  🟡 WARNING: ${warningCount}개\n`);

  let lastLine = -1;
  for (const issue of allIssues) {
    if (issue.line !== lastLine) {
      console.log(`\n📍 줄 ${issue.line}`);
      lastLine = issue.line;
    }

    const icon = issue.severity === 'ERROR' ? '🔴' : '🟡';
    console.log(`  ${icon} [P${issue.severity === 'ERROR' ? '0' : '1'}.${issue.ruleId}] ${issue.ruleName}`);
    console.log(`     현재: ${issue.code}`);
    console.log(`     수정: ${issue.fix}\n`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`총 ${allIssues.length}개 이슈 발견`);
  if (errorCount > 0) {
    console.log(`🔴 P0 규칙 위반: ${errorCount}개 (반드시 수정)`);
  }
  if (warningCount > 0) {
    console.log(`🟡 P1 규칙 위반: ${warningCount}개 (권장 수정)`);
  }
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  process.exit(errorCount > 0 ? 1 : 0);
}

// CLI 실행
const filePath = process.argv[2];
if (!filePath) {
  console.error('사용법: freelang-lint <file.fl>');
  console.error('예: freelang-lint app/server.fl');
  process.exit(1);
}

lintFile(filePath);
