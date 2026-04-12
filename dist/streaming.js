"use strict";
// FreeLang v9 Streaming Output
// Phase 105: AI가 생성한 결과를 토큰 단위로 스트리밍
// (stream-create) → StreamHandle
// (stream-write handle "chunk")
// (stream-end handle)
// (stream-on-chunk handle fn)
// (stream-collect handle) → Promise<string>
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLStream = void 0;
exports.streamText = streamText;
exports.createStream = createStream;
exports.getStream = getStream;
exports.deleteStream = deleteStream;
const events_1 = require("events");
class FLStream extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.chunks = [];
        this.chunkIndex = 0;
        this._done = false;
        this._collected = '';
    }
    write(content) {
        if (this._done)
            return;
        const chunk = {
            index: this.chunkIndex++,
            content,
            done: false,
            timestamp: Date.now()
        };
        this.chunks.push(chunk);
        this._collected += content;
        this.emit('chunk', chunk);
    }
    end() {
        if (this._done)
            return;
        this._done = true;
        const finalChunk = {
            index: this.chunkIndex++,
            content: '',
            done: true,
            timestamp: Date.now()
        };
        this.chunks.push(finalChunk);
        this.emit('chunk', finalChunk);
        this.emit('end', this._collected);
    }
    collect() {
        if (this._done)
            return Promise.resolve(this._collected);
        return new Promise(resolve => {
            this.once('end', resolve);
        });
    }
    isDone() { return this._done; }
    getChunks() { return [...this.chunks]; }
    collected() { return this._collected; }
    chunkCount() { return this.chunks.filter(c => !c.done).length; }
}
exports.FLStream = FLStream;
// 텍스트를 단어 단위로 스트리밍하는 유틸
function streamText(stream, text, delayMs = 0) {
    const words = text.split(' ');
    return new Promise(resolve => {
        let i = 0;
        function next() {
            if (i >= words.length) {
                stream.end();
                resolve();
                return;
            }
            stream.write(i === 0 ? words[i] : ' ' + words[i]);
            i++;
            if (delayMs > 0)
                setTimeout(next, delayMs);
            else
                next();
        }
        next();
    });
}
// 글로벌 스트림 레지스트리
const streamRegistry = new Map();
let streamCounter = 0;
function createStream() {
    const id = `stream-${++streamCounter}`;
    const stream = new FLStream();
    streamRegistry.set(id, stream);
    return { id, stream };
}
function getStream(id) {
    return streamRegistry.get(id) ?? null;
}
function deleteStream(id) {
    return streamRegistry.delete(id);
}
//# sourceMappingURL=streaming.js.map