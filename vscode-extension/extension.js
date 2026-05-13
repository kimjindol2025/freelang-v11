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
      const items = [
        // Keywords
        'defn', 'let', 'if', 'when', 'loop', 'try', 'catch',
        'map', 'filter', 'reduce', 'for', 'doseq',

        // Server
        'server-start', 'server-json', 'server-html', 'server-status',

        // DB
        'db-query', 'db-exec', 'db-transaction',

        // Auth
        'auth-jwt-sign', 'auth-jwt-verify', 'auth-hash-password',

        // Utilities
        'println', 'str', 'str-split', 'str-includes',
        'get', 'assoc', 'obj-merge', 'obj-keys'
      ].map(label => new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword));

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
