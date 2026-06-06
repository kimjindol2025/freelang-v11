#!/usr/bin/env node
// MongoDB Driver Helper — FreeLang v11
// High-level MongoDB 작업 + 트랜잭션 지원
// 인자: node _mongodb_helper.js '<JSON 요청>'

const { MongoClient, ObjectId } = require("mongodb");
const { argv } = process;

const request = argv[2] ? JSON.parse(argv[2]) : {};

// 연결 URI 캐시 (같은 프로세스 내 재사용 불가, 매 호출마다 새 연결)
async function withClient(uri, timeout, fn) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: timeout,
    connectTimeoutMS: timeout,
    socketTimeoutMS: timeout,
  });
  try {
    await client.connect();
    const result = await fn(client);
    return result;
  } finally {
    await client.close();
  }
}

function makeUri(host, port, user, pass, authDb) {
  if (user && pass) {
    const creds = `${encodeURIComponent(user)}:${encodeURIComponent(pass)}`;
    return `mongodb://${creds}@${host}:${port}/${authDb || "admin"}`;
  }
  return `mongodb://${host}:${port}`;
}

// ObjectId 문자열 변환 (재귀)
function serializeDoc(doc) {
  if (!doc || typeof doc !== "object") return doc;
  if (Array.isArray(doc)) return doc.map(serializeDoc);
  const out = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v instanceof ObjectId) out[k] = v.toString();
    else if (v && typeof v === "object" && v.constructor?.name === "ObjectId") out[k] = v.toString();
    else if (v && typeof v === "object") out[k] = serializeDoc(v);
    else out[k] = v;
  }
  return out;
}

// _id 문자열 → ObjectId 변환 (필터에서)
function parseFilter(filter) {
  if (!filter || typeof filter !== "object") return filter || {};
  const out = { ...filter };
  if (out._id && typeof out._id === "string" && out._id.length === 24) {
    try { out._id = new ObjectId(out._id); } catch {}
  }
  return out;
}

async function handleRequest(req) {
  const {
    method,
    host = "localhost",
    port = 27017,
    user,
    pass,
    authDb,
    db: dbName,
    collection: collName,
    filter = {},
    doc,
    docs,
    update,
    pipeline,
    ops,
    options = {},
    timeout = 10000,
    limit,
    skip,
    sort,
    projection,
  } = req;

  const uri = makeUri(host, port, user, pass, authDb);

  switch (method) {
    // ── 연결 테스트 ────────────────────────────────────────────
    case "ping": {
      return withClient(uri, timeout, async (client) => {
        await client.db("admin").command({ ping: 1 });
        return { ok: true };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 단건 조회 ─────────────────────────────────────────────
    case "find_one": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const doc = await col.findOne(parseFilter(filter), { projection });
        return { ok: true, doc: doc ? serializeDoc(doc) : null };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 다건 조회 ─────────────────────────────────────────────
    case "find_many": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        let cursor = col.find(parseFilter(filter), { projection });
        if (sort) cursor = cursor.sort(sort);
        if (skip) cursor = cursor.skip(skip);
        if (limit) cursor = cursor.limit(limit);
        const docs = await cursor.toArray();
        return { ok: true, docs: docs.map(serializeDoc), count: docs.length };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 카운트 ────────────────────────────────────────────────
    case "count": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const n = await col.countDocuments(parseFilter(filter));
        return { ok: true, count: n };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 단건 삽입 ─────────────────────────────────────────────
    case "insert_one": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.insertOne(doc);
        return { ok: true, inserted_id: r.insertedId.toString() };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 다건 삽입 ─────────────────────────────────────────────
    case "insert_many": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.insertMany(docs);
        return {
          ok: true,
          inserted_count: r.insertedCount,
          inserted_ids: Object.values(r.insertedIds).map(id => id.toString()),
        };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 단건 수정 ─────────────────────────────────────────────
    case "update_one": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.updateOne(parseFilter(filter), update, options);
        return { ok: true, matched: r.matchedCount, modified: r.modifiedCount };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 다건 수정 ─────────────────────────────────────────────
    case "update_many": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.updateMany(parseFilter(filter), update, options);
        return { ok: true, matched: r.matchedCount, modified: r.modifiedCount };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 단건 삭제 ─────────────────────────────────────────────
    case "delete_one": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.deleteOne(parseFilter(filter));
        return { ok: true, deleted: r.deletedCount };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 다건 삭제 ─────────────────────────────────────────────
    case "delete_many": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const r = await col.deleteMany(parseFilter(filter));
        return { ok: true, deleted: r.deletedCount };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── Aggregation Pipeline ───────────────────────────────────
    case "aggregate": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const docs = await col.aggregate(pipeline).toArray();
        return { ok: true, docs: docs.map(serializeDoc), count: docs.length };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 트랜잭션 ──────────────────────────────────────────────
    // ops: [{method, db, collection, ...}, ...]
    // 모든 ops 성공 시 commit, 하나라도 실패 시 abort
    case "transaction": {
      return withClient(uri, timeout, async (client) => {
        const session = client.startSession();
        const results = [];
        try {
          await session.withTransaction(async () => {
            for (const op of ops) {
              const col = client.db(op.db || dbName).collection(op.collection || collName);
              const opFilter = parseFilter(op.filter || {});

              if (op.method === "insert_one") {
                const r = await col.insertOne(op.doc, { session });
                results.push({ ok: true, inserted_id: r.insertedId.toString() });
              } else if (op.method === "insert_many") {
                const r = await col.insertMany(op.docs, { session });
                results.push({ ok: true, inserted_count: r.insertedCount });
              } else if (op.method === "update_one") {
                const r = await col.updateOne(opFilter, op.update, { session, ...op.options });
                results.push({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
              } else if (op.method === "update_many") {
                const r = await col.updateMany(opFilter, op.update, { session, ...op.options });
                results.push({ ok: true, matched: r.matchedCount, modified: r.modifiedCount });
              } else if (op.method === "delete_one") {
                const r = await col.deleteOne(opFilter, { session });
                results.push({ ok: true, deleted: r.deletedCount });
              } else if (op.method === "delete_many") {
                const r = await col.deleteMany(opFilter, { session });
                results.push({ ok: true, deleted: r.deletedCount });
              } else if (op.method === "find_one") {
                const d = await col.findOne(opFilter, { session });
                results.push({ ok: true, doc: d ? serializeDoc(d) : null });
              } else {
                throw new Error(`Unknown tx op: ${op.method}`);
              }
            }
          });
          return { ok: true, committed: true, results };
        } catch (err) {
          return { ok: false, error: err.message, aborted: true, results };
        } finally {
          await session.endSession();
        }
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 인덱스 생성 ───────────────────────────────────────────
    case "create_index": {
      return withClient(uri, timeout, async (client) => {
        const col = client.db(dbName).collection(collName);
        const name = await col.createIndex(filter, options);
        return { ok: true, name };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 컬렉션 목록 ───────────────────────────────────────────
    case "list_collections": {
      return withClient(uri, timeout, async (client) => {
        const cols = await client.db(dbName).listCollections().toArray();
        return { ok: true, collections: cols.map(c => c.name) };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    // ── 하위 호환: Wire Protocol 연결 테스트 ─────────────────
    case "connect": {
      return withClient(uri, timeout, async () => {
        return { ok: true };
      }).catch(err => ({ ok: false, error: err.message }));
    }

    default:
      return { ok: false, error: `Unknown method: ${method}` };
  }
}

(async () => {
  const result = await handleRequest(request);
  console.log(JSON.stringify(result));
})();
