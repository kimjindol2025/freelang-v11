// VS Code Extension for FreeLang
// 설치: symlink to ~/.vscode/extensions/freelang-editor-1.0.0/

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let freelangProcess = null;

/**
 * 확장프로그램 활성화
 */
function activate(context) {
  console.log('🚀 FreeLang VS Code extension activated');

  // 1. Language Support
  registerLanguageFeatures(context);

  // 2. Commands
  registerCommands(context);

  // 3. Diagnostics (에러 표시)
  registerDiagnostics(context);

  // 4. Hover Info
  registerHoverProvider(context);

  // 5. Completion
  registerCompletionProvider(context);
}

/**
 * 언어 기능 등록
 */
function registerLanguageFeatures(context) {
  const freelangSelector = { language: 'freelang', scheme: 'file' };

  // Syntax Highlighting은 package.json에서 정의

  // Format on Save
  vscode.languages.registerDocumentFormattingEditProvider(freelangSelector, {
    provideDocumentFormattingEdits(document) {
      // freelang fmt를 호출
      const formatted = execSync(`freelang fmt "${document.fileName}"`);
      return [
        new vscode.TextEdit(
          new vscode.Range(0, 0, document.lineCount, 0),
          formatted
        )
      ];
    }
  });
}

/**
 * 명령어 등록
 */
function registerCommands(context) {
  // 1. Run File
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.runFile', runCurrentFile)
  );

  // 2. Reload/Hot Reload
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.reload', hotReloadFile)
  );

  // 3. Format
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.format', formatFile)
  );

  // 4. Lint
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.lint', lintFile)
  );

  // 5. Start Server
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.startServer', startServer)
  );

  // 6. Stop Server
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.stopServer', stopServer)
  );

  // 7. Documentation
  context.subscriptions.push(
    vscode.commands.registerCommand('freelang.docs', showDocumentation)
  );
}

/**
 * 현재 파일 실행
 */
async function runCurrentFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const filePath = editor.document.fileName;
  vscode.window.showInformationMessage(`Running ${path.basename(filePath)}...`);

  try {
    const output = execSync(`node bootstrap.js run "${filePath}"`);
    showOutput('FreeLang', output);
  } catch (err) {
    vscode.window.showErrorMessage(`Error: ${err.message}`);
  }
}

/**
 * 파일 자동 재로드 (Hot Reload)
 */
async function hotReloadFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const filePath = editor.document.fileName;
  vscode.window.showInformationMessage(`🔄 Reloading ${path.basename(filePath)}...`);

  try {
    // freelang REPL에 reload 명령 전송
    execSync(`echo '(reload "${filePath}")' | node bootstrap.js repl`);
    vscode.window.showInformationMessage('✅ Reloaded!');
  } catch (err) {
    vscode.window.showErrorMessage(`Reload failed: ${err.message}`);
  }
}

/**
 * 파일 포맷팅
 */
async function formatFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  try {
    const formatted = execSync(`freelang fmt "${editor.document.fileName}"`);
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      editor.document.uri,
      new vscode.Range(0, 0, editor.document.lineCount, 0),
      formatted
    );
    await vscode.workspace.applyEdit(edit);
    vscode.window.showInformationMessage('✅ Formatted!');
  } catch (err) {
    vscode.window.showErrorMessage(`Format error: ${err.message}`);
  }
}

/**
 * 파일 Lint
 */
async function lintFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  try {
    const output = execSync(`freelang lint "${editor.document.fileName}"`);
    showOutput('FreeLang Lint', output);
  } catch (err) {
    // lint는 경고만 출력
    showOutput('FreeLang Lint', err.stdout?.toString() || err.message);
  }
}

/**
 * 서버 시작
 */
async function startServer() {
  vscode.window.showInformationMessage('🚀 Starting FreeLang server...');

  try {
    freelangProcess = spawn('node', ['bootstrap.js', 'serve', 'app/'], {
      cwd: vscode.workspace.rootPath
    });

    freelangProcess.stdout.on('data', (data) => {
      showOutput('FreeLang Server', data.toString());
    });

    freelangProcess.stderr.on('data', (data) => {
      showOutput('FreeLang Server', `❌ ${data.toString()}`);
    });

    vscode.window.showInformationMessage('✅ Server started!');
  } catch (err) {
    vscode.window.showErrorMessage(`Server start failed: ${err.message}`);
  }
}

/**
 * 서버 중지
 */
function stopServer() {
  if (freelangProcess) {
    freelangProcess.kill();
    freelangProcess = null;
    vscode.window.showInformationMessage('🛑 Server stopped');
  }
}

/**
 * 문서 표시
 */
function showDocumentation() {
  vscode.env.openExternal(vscode.Uri.parse('https://www.npmjs.com/package/freelang-editor'));
}

/**
 * Diagnostics 등록 (에러/경고 표시)
 */
function registerDiagnostics(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('freelang');

  vscode.workspace.onDidSaveTextDocument((document) => {
    if (document.languageId !== 'freelang') return;

    try {
      const output = execSync(`freelang lint "${document.fileName}"`, {
        encoding: 'utf-8'
      });

      const diagnostics = parseLintOutput(output, document);
      diagnosticCollection.set(document.uri, diagnostics);
    } catch (err) {
      // 에러가 있으면 파싱
      const diagnostics = parseLintOutput(err.stdout?.toString() || '', document);
      diagnosticCollection.set(document.uri, diagnostics);
    }
  });

  context.subscriptions.push(diagnosticCollection);
}

/**
 * Hover Information
 */
function registerHoverProvider(context) {
  vscode.languages.registerHoverProvider('freelang', {
    provideHover(document, position) {
      const word = document.getWordRangeAtPosition(position);
      if (!word) return;

      const text = document.getText(word);

      // 간단한 내장 함수 도움말
      const builtins = {
        'defn': '함수 정의: (defn name [args] body)',
        'let': '바인딩: (let [x 1 y 2] body)',
        'map': '맵: (map fn coll)',
        'filter': '필터: (filter pred coll)',
        'reduce': '축약: (reduce fn coll)',
        'server-start': '서버 시작: (server-start port)',
        'db-query': 'DB 쿼리: (db-query db sql params)',
        'auth-jwt-sign': 'JWT 서명: (auth-jwt-sign payload secret ttl)'
      };

      if (builtins[text]) {
        return new vscode.Hover(builtins[text]);
      }
    }
  });
}

/**
 * Code Completion
 */
function registerCompletionProvider(context) {
  vscode.languages.registerCompletionItemProvider('freelang', {
    provideCompletionItems() {
      const completions = [
        // Control Flow
        { label: 'defn', kind: 'Function', doc: '(defn name [args] body) — 함수 정의' },
        { label: 'fn', kind: 'Keyword', doc: '(fn [args] body) — 익명 함수' },
        { label: 'let', kind: 'Keyword', doc: '(let [x 1 y 2] body) — 지역 바인딩' },
        { label: 'if', kind: 'Keyword', doc: '(if cond then else) — 조건' },
        { label: 'when', kind: 'Keyword', doc: '(when cond body) — 참일 때만' },
        { label: 'loop', kind: 'Keyword', doc: '(loop [x 0] (recur (inc x))) — 재귀' },
        { label: 'try', kind: 'Keyword', doc: '(try body (catch e handler)) — 예외 처리' },

        // Collections
        { label: 'map', kind: 'Function', doc: '(map fn coll) — 함수 적용' },
        { label: 'filter', kind: 'Function', doc: '(filter fn coll) — 조건 필터' },
        { label: 'reduce', kind: 'Function', doc: '(reduce fn init coll) — 축약' },
        { label: 'for', kind: 'Keyword', doc: '(for [x coll] body) — 컴프리헨션' },
        { label: 'doseq', kind: 'Keyword', doc: '(doseq [x coll] body) — 순회' },
        { label: 'sort', kind: 'Function', doc: '(sort coll) — 정렬' },
        { label: 'reverse', kind: 'Function', doc: '(reverse coll) — 역순' },

        // Server
        { label: 'server-start', kind: 'Function', doc: '(server-start port) — 서버 시작' },
        { label: 'server-json', kind: 'Function', doc: '(server-json obj) — JSON 응답' },
        { label: 'server-html', kind: 'Function', doc: '(server-html str) — HTML 응답' },
        { label: 'server-status', kind: 'Function', doc: '(server-status code msg) — 상태 코드' },
        { label: 'route', kind: 'Function', doc: '(route routes) — 라우트 등록' },

        // Database
        { label: 'db-query', kind: 'Function', doc: '(db-query db sql params) — 쿼리 실행' },
        { label: 'db-exec', kind: 'Function', doc: '(db-exec db sql params) — 명령 실행' },
        { label: 'db-transaction', kind: 'Function', doc: '(db-transaction db body) — 트랜잭션' },

        // Auth
        { label: 'auth-jwt-sign', kind: 'Function', doc: '(auth-jwt-sign payload secret ttl) — JWT 생성' },
        { label: 'auth-jwt-verify', kind: 'Function', doc: '(auth-jwt-verify token secret) — JWT 검증' },
        { label: 'auth-hash-password', kind: 'Function', doc: '(auth-hash-password pwd) — 비밀번호 해싱' },
        { label: 'auth-verify-password', kind: 'Function', doc: '(auth-verify-password pwd hash) — 비밀번호 확인' },

        // String
        { label: 'str', kind: 'Function', doc: '(str a b c) — 문자열 연결' },
        { label: 'str-split', kind: 'Function', doc: '(str-split s sep) — 문자열 분할' },
        { label: 'str-includes', kind: 'Function', doc: '(str-includes s substr) — 포함 여부' },
        { label: 'str-trim', kind: 'Function', doc: '(str-trim s) — 공백 제거' },
        { label: 'str-replace', kind: 'Function', doc: '(str-replace s old new) — 문자열 치환' },
        { label: 'str-to-upper', kind: 'Function', doc: '(str-to-upper s) — 대문자' },
        { label: 'str-to-lower', kind: 'Function', doc: '(str-to-lower s) — 소문자' },

        // Object/Map
        { label: 'get', kind: 'Function', doc: '(get map key default) — 값 추출' },
        { label: 'assoc', kind: 'Function', doc: '(assoc map key val) — 값 설정' },
        { label: 'obj-merge', kind: 'Function', doc: '(obj-merge m1 m2) — 객체 병합' },
        { label: 'obj-keys', kind: 'Function', doc: '(obj-keys map) — 키 목록' },
        { label: 'obj-values', kind: 'Function', doc: '(obj-values map) — 값 목록' },

        // Math
        { label: 'inc', kind: 'Function', doc: '(inc x) — x + 1' },
        { label: 'dec', kind: 'Function', doc: '(dec x) — x - 1' },
        { label: 'abs', kind: 'Function', doc: '(abs x) — 절댓값' },
        { label: 'pow', kind: 'Function', doc: '(pow x n) — 거듭제곱' },
        { label: 'sqrt', kind: 'Function', doc: '(sqrt x) — 제곱근' },

        // Utilities
        { label: 'println', kind: 'Function', doc: '(println a b c) — 콘솔 출력' },
        { label: 'type-of', kind: 'Function', doc: '(type-of x) — 타입 확인' },
        { label: 'nil?', kind: 'Function', doc: '(nil? x) — nil 여부' },
        { label: 'empty?', kind: 'Function', doc: '(empty? coll) — 비어있는지 확인' },
      ];

      const items = completions.map(c => {
        const item = new vscode.CompletionItem(c.label, vscode.CompletionItemKind[c.kind]);
        item.documentation = c.doc;
        item.detail = c.doc;
        return item;
      });

      return items;
    }
  });
}

/**
 * 출력 표시
 */
function showOutput(channel, message) {
  const outputChannel = vscode.window.createOutputChannel(channel);
  outputChannel.appendLine(message);
  outputChannel.show();
}

/**
 * Lint 출력 파싱
 */
function parseLintOutput(output, document) {
  const diagnostics = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // 형식: filename:line:col: message
    const match = line.match(/(\d+):(\d+): (.+)/);
    if (match) {
      const lineNum = parseInt(match[1]) - 1;
      const col = parseInt(match[2]);
      const message = match[3];

      diagnostics.push(new vscode.Diagnostic(
        new vscode.Range(lineNum, col, lineNum, col + 1),
        message,
        vscode.DiagnosticSeverity.Warning
      ));
    }
  }

  return diagnostics;
}

/**
 * 확장프로그램 비활성화
 */
function deactivate() {
  if (freelangProcess) {
    freelangProcess.kill();
  }
}

module.exports = { activate, deactivate };
