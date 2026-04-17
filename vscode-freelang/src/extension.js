// FreeLang VSCode extension entry — minimal
// - Runs `node bootstrap.js check <file>` on save and surfaces parse errors as diagnostics.
// - LSP stdio bridge can be wired later once src/lsp-server.ts exposes a main().

const vscode = require("vscode");
const cp = require("child_process");
const path = require("path");
const fs = require("fs");

function findBootstrap(configPath, workspaceRoot) {
  if (configPath && fs.existsSync(configPath)) return configPath;
  if (workspaceRoot) {
    const guess = path.join(workspaceRoot, "bootstrap.js");
    if (fs.existsSync(guess)) return guess;
  }
  return null;
}

function parseErrorLocation(stderr) {
  // "파싱 오류  file.fl:LINE:COL" pattern
  const m = stderr.match(/([^\s:]+\.fl):(\d+):(\d+)/);
  if (!m) return null;
  return { file: m[1], line: parseInt(m[2], 10) - 1, col: parseInt(m[3], 10) - 1 };
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection("freelang");
  context.subscriptions.push(collection);

  const runCheck = (doc) => {
    if (doc.languageId !== "freelang") return;
    const ws = vscode.workspace.getWorkspaceFolder(doc.uri);
    const cfg = vscode.workspace.getConfiguration("freelang");
    const bootstrap = findBootstrap(cfg.get("bootstrapPath"), ws && ws.uri.fsPath);
    if (!bootstrap) {
      collection.delete(doc.uri);
      return;
    }
    cp.execFile("node", [bootstrap, "check", doc.uri.fsPath], (err, _stdout, stderr) => {
      if (!err) {
        collection.delete(doc.uri);
        return;
      }
      const loc = parseErrorLocation(stderr || "");
      if (!loc) {
        collection.set(doc.uri, [new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 100),
          (stderr || "check failed").trim().split("\n")[0],
          vscode.DiagnosticSeverity.Error,
        )]);
        return;
      }
      const range = new vscode.Range(loc.line, loc.col, loc.line, loc.col + 1);
      const msg = (stderr || "").split("\n").find((l) => /error|오류/i.test(l)) || "Parse error";
      collection.set(doc.uri, [new vscode.Diagnostic(range, msg.trim(), vscode.DiagnosticSeverity.Error)]);
    });
  };

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(runCheck),
    vscode.workspace.onDidOpenTextDocument(runCheck),
  );

  // Status bar: show FreeLang version when .fl file is active
  const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  bar.text = "$(rocket) FreeLang v11";
  context.subscriptions.push(bar);
  const updateBar = () => {
    const ed = vscode.window.activeTextEditor;
    if (ed && ed.document.languageId === "freelang") bar.show();
    else bar.hide();
  };
  updateBar();
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateBar),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
