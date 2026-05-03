// freelang patch + migrate 명령 구현
"use strict";
const fs = require("fs");
const path = require("path");

function cmdPatch(patchArgs) {
  const filePath = patchArgs[0];
  if (!filePath) {
    console.error("Usage:\n  freelang patch <file> --find <text> --replace <text>\n  freelang patch <file> --insert-after <anchor> --content <block>\n  freelang patch <file> --insert-before <anchor> --content <block>\n  freelang patch <file> --delete-line <pattern>");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) { console.error(`[patch] 파일 없음: ${filePath}`); process.exit(1); }
  let content = fs.readFileSync(filePath, "utf8");
  const get = (f) => { const i = patchArgs.indexOf(f); return i >= 0 ? patchArgs[i + 1] : null; };
  const findText = get("--find"), replaceText = get("--replace");
  const insertAfter = get("--insert-after"), insertBefore = get("--insert-before");
  const insertContent = get("--content"), deleteLine = get("--delete-line"), nth = get("--nth");
  let changed = false;
  if (findText !== null && replaceText !== null) {
    if (nth !== null) {
      let count = 0; const target = parseInt(nth, 10);
      const nc = content.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), (m) => { count++; return count === target ? replaceText : m; });
      if (nc === content) { console.error(`[patch] 텍스트 없음 (${nth}번째): ${findText}`); process.exit(1); }
      content = nc;
    } else {
      if (!content.includes(findText)) { console.error(`[patch] --find 텍스트 없음: ${findText}`); process.exit(1); }
      content = content.split(findText).join(replaceText);
    }
    changed = true;
  } else if (insertAfter !== null && insertContent !== null) {
    const idx = content.indexOf(insertAfter);
    if (idx < 0) { console.error(`[patch] --insert-after 앵커 없음: ${insertAfter}`); process.exit(1); }
    content = content.slice(0, idx + insertAfter.length) + "\n" + insertContent + content.slice(idx + insertAfter.length);
    changed = true;
  } else if (insertBefore !== null && insertContent !== null) {
    const idx = content.indexOf(insertBefore);
    if (idx < 0) { console.error(`[patch] --insert-before 앵커 없음: ${insertBefore}`); process.exit(1); }
    content = content.slice(0, idx) + insertContent + "\n" + content.slice(idx);
    changed = true;
  } else if (deleteLine !== null) {
    const lines = content.split("\n"), before = lines.length;
    const filtered = lines.filter((l) => !l.includes(deleteLine));
    if (filtered.length === before) { console.error(`[patch] --delete-line 패턴 없음: ${deleteLine}`); process.exit(1); }
    content = filtered.join("\n"); changed = true;
  } else { console.error("[patch] 옵션 부족: --find/--replace, --insert-after/--content, --insert-before/--content, --delete-line 필요"); process.exit(1); }
  if (changed) { fs.writeFileSync(filePath, content, "utf8"); console.log(`\x1B[32m[patch]\x1B[0m ✓ ${filePath}`); }
}

async function cmdMigrate(migrateArgs) {
  let mysql; try { mysql = require("mysql2/promise"); } catch { console.error("[migrate] mysql2 필요: npm install mysql2"); process.exit(1); }
  const sub = migrateArgs[0];
  const dir = path.resolve(process.cwd(), "migrations");
  const envFile = path.resolve(process.cwd(), ".env");
  const loadEnv = () => {
    const e = {};
    if (fs.existsSync(envFile)) fs.readFileSync(envFile, "utf8").split("\n").forEach((l) => { const m = l.match(/^([^#=]+)=(.*)/); if (m) e[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, ""); });
    return e;
  };
  const getConn = async () => {
    const e = { ...loadEnv(), ...process.env };
    return mysql.createConnection({ host: e.DB_HOST || "127.0.0.1", port: parseInt(e.DB_PORT || "3306"), user: e.DB_USER || "akl", password: e.DB_PASS || e.DB_PASSWORD || "akl_pass_2026", database: e.DB_NAME || e.DB_DATABASE || "akl", multipleStatements: true });
  };
  const ensureTable = async (c) => c.execute("CREATE TABLE IF NOT EXISTS _migrations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
  if (!sub || sub === "help") {
    console.log("\nUsage:\n  freelang migrate create <name>   새 마이그레이션 생성\n  freelang migrate up               미적용 실행\n  freelang migrate down             마지막 롤백\n  freelang migrate status           현황 확인\n  freelang migrate reset            전체 롤백\n");
    return;
  }
  if (sub === "create") {
    const name = migrateArgs[1]; if (!name) { console.error("Usage: freelang migrate create <name>"); process.exit(1); }
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
    const fname = `${ts}_${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.sql`;
    fs.writeFileSync(path.join(dir, fname), `-- Migration: ${name}\n-- Created: ${new Date().toISOString()}\n\n-- UP\n\n\n-- DOWN\n-- 롤백 SQL\n`);
    console.log(`\x1B[32m[migrate]\x1B[0m ✓ migrations/${fname}`);
    return;
  }
  const conn = await getConn();
  try {
    await ensureTable(conn);
    const getFiles = () => { fs.mkdirSync(dir, { recursive: true }); return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort(); };
    const getApplied = async () => { const [rows] = await conn.execute("SELECT name FROM _migrations"); return new Set(rows.map((r) => r.name)); };
    if (sub === "status") {
      const files = getFiles(), applied = await getApplied();
      if (!files.length) { console.log("\x1B[2m[migrate] 없음\x1B[0m"); return; }
      console.log(`\n\x1B[36m[migrate]\x1B[0m  ${dir}\n`);
      for (const f of files) console.log(`  ${applied.has(f) ? "\x1B[32m✓\x1B[0m" : "\x1B[33m○\x1B[0m"}  ${f}`);
      console.log(`\n  총 ${files.length} / 적용 ${applied.size} / 미적용 ${files.filter((f) => !applied.has(f)).length}\n`);
    } else if (sub === "up") {
      const files = getFiles(), applied = await getApplied();
      const pending = files.filter((f) => !applied.has(f));
      if (!pending.length) { console.log("\x1B[32m[migrate]\x1B[0m 최신 상태."); return; }
      for (const f of pending) {
        const sql = fs.readFileSync(path.join(dir, f), "utf8");
        const upSql = (sql.includes("-- DOWN") ? sql.split("-- DOWN")[0] : sql).replace(/^--[^\n]*\n/gm, "").trim();
        if (!upSql) { console.log(`\x1B[33m[migrate]\x1B[0m 건너뜀: ${f}`); continue; }
        process.stdout.write(`\x1B[36m[migrate]\x1B[0m  ${f} ... `);
        await conn.execute(upSql);
        await conn.execute("INSERT INTO _migrations (name) VALUES (?)", [f]);
        console.log("\x1B[32m✓\x1B[0m");
      }
      console.log(`\x1B[32m[migrate]\x1B[0m ${pending.length}개 완료`);
    } else if (sub === "down") {
      const [rows] = await conn.execute("SELECT name FROM _migrations ORDER BY applied_at DESC LIMIT 1");
      if (!rows.length) { console.log("[migrate] 롤백할 항목 없음"); return; }
      const last = rows[0].name, fp = path.join(dir, last);
      if (!fs.existsSync(fp)) { console.error(`[migrate] 파일 없음: ${fp}`); process.exit(1); }
      const sql = fs.readFileSync(fp, "utf8");
      const downSql = sql.includes("-- DOWN") ? sql.split("-- DOWN")[1].replace(/^--[^\n]*\n/gm, "").trim() : "";
      if (!downSql) { console.error(`[migrate] DOWN SQL 없음: ${last}`); process.exit(1); }
      process.stdout.write(`\x1B[36m[migrate]\x1B[0m  롤백: ${last} ... `);
      await conn.execute(downSql);
      await conn.execute("DELETE FROM _migrations WHERE name = ?", [last]);
      console.log("\x1B[32m✓\x1B[0m");
    } else if (sub === "reset") {
      const [rows] = await conn.execute("SELECT name FROM _migrations ORDER BY applied_at DESC");
      if (!rows.length) { console.log("[migrate] 없음"); return; }
      for (const row of rows) {
        const fp = path.join(dir, row.name);
        if (!fs.existsSync(fp)) continue;
        const sql = fs.readFileSync(fp, "utf8");
        const downSql = sql.includes("-- DOWN") ? sql.split("-- DOWN")[1].replace(/^--[^\n]*\n/gm, "").trim() : "";
        if (downSql) await conn.execute(downSql);
        await conn.execute("DELETE FROM _migrations WHERE name = ?", [row.name]);
        console.log(`\x1B[33m[migrate]\x1B[0m  롤백: ${row.name}`);
      }
    } else { console.error(`[migrate] 알 수 없는 명령: ${sub}`); process.exit(1); }
  } finally { await conn.end(); }
}

module.exports = { cmdPatch, cmdMigrate };
