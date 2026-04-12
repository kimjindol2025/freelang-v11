"use strict";
// stdlib-channel.ts — FreeLang v9 Phase 67
// 채널 기반 동시성: 버퍼드 큐 채널 (동기 버전)
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = void 0;
exports.createChannelModule = createChannelModule;
let _chanIdCounter = 0;
function genId() {
    return `ch_${++_chanIdCounter}_${Date.now()}`;
}
// ── Channel 클래스 ─────────────────────────────────────────────────
class Channel {
    constructor(size = 100) {
        this.queue = [];
        this.maxSize = size;
    }
    /** 값을 채널에 보냄. 가득 차면 false 반환 */
    send(val) {
        if (this.queue.length >= this.maxSize)
            return false;
        this.queue.push(val);
        return true;
    }
    /** 채널에서 값을 꺼냄. 비어있으면 null 반환 */
    recv() {
        return this.queue.shift() ?? null;
    }
    size() {
        return this.queue.length;
    }
    isEmpty() {
        return this.queue.length === 0;
    }
    isFull() {
        return this.queue.length >= this.maxSize;
    }
}
exports.Channel = Channel;
// ── 채널 레지스트리 (전역 Map) ─────────────────────────────────────
const channels = new Map();
// ── createChannelModule: 채널 함수들 ─────────────────────────────
function createChannelModule() {
    return {
        // (chan) or (chan 50) → channel-id
        "chan": (size) => {
            const id = genId();
            channels.set(id, new Channel(typeof size === "number" ? size : 100));
            return id;
        },
        // (chan-send ch-id value) → boolean
        "chan-send": (id, val) => {
            const ch = channels.get(id);
            if (!ch)
                return false;
            return ch.send(val);
        },
        // (chan-recv ch-id) → value or null
        "chan-recv": (id) => {
            const ch = channels.get(id);
            if (!ch)
                return null;
            return ch.recv();
        },
        // (chan-size ch-id) → number
        "chan-size": (id) => {
            const ch = channels.get(id);
            if (!ch)
                return 0;
            return ch.size();
        },
        // (chan-empty? ch-id) → boolean
        "chan-empty?": (id) => {
            const ch = channels.get(id);
            if (!ch)
                return true;
            return ch.isEmpty();
        },
        // (chan-full? ch-id) → boolean
        "chan-full?": (id) => {
            const ch = channels.get(id);
            if (!ch)
                return true;
            return ch.isFull();
        },
        // (chan-close ch-id) → boolean (채널 제거)
        "chan-close": (id) => {
            return channels.delete(id);
        },
    };
}
//# sourceMappingURL=stdlib-channel.js.map