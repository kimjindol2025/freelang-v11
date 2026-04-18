// stdlib-channel.ts — FreeLang v9 Phase 67
// 채널 기반 동시성: 버퍼드 큐 채널 (동기 버전)

let _chanIdCounter = 0;
function genId(): string {
  return `ch_${++_chanIdCounter}_${Date.now()}`;
}

// ── Channel 클래스 ─────────────────────────────────────────────────
export class Channel {
  private queue: any[] = [];
  private maxSize: number;

  constructor(size = 100) {
    this.maxSize = size;
  }

  /** 값을 채널에 보냄. 가득 차면 false 반환 */
  send(val: any): boolean {
    if (this.queue.length >= this.maxSize) return false;
    this.queue.push(val);
    return true;
  }

  /** 채널에서 값을 꺼냄. 비어있으면 null 반환 */
  recv(): any {
    return this.queue.shift() ?? null;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  isFull(): boolean {
    return this.queue.length >= this.maxSize;
  }
}

// ── 채널 레지스트리 (전역 Map) ─────────────────────────────────────
const channels = new Map<string, Channel>();

// ── createChannelModule: 채널 함수들 ─────────────────────────────
export function createChannelModule(): Record<string, Function> {
  return {
    // (chan) or (chan 50) → channel-id
    "chan": (size?: number) => {
      const id = genId();
      channels.set(id, new Channel(typeof size === "number" ? size : 100));
      return id;
    },

    // (chan-send ch-id value) → boolean
    "chan-send": (id: string, val: any) => {
      const ch = channels.get(id);
      if (!ch) return false;
      return ch.send(val);
    },

    // (chan-recv ch-id) → value or null
    "chan-recv": (id: string) => {
      const ch = channels.get(id);
      if (!ch) return null;
      return ch.recv();
    },

    // (chan-size ch-id) → number
    "chan-size": (id: string) => {
      const ch = channels.get(id);
      if (!ch) return 0;
      return ch.size();
    },

    // (chan-empty? ch-id) → boolean
    "chan-empty?": (id: string) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isEmpty();
    },

    // (chan-full? ch-id) → boolean
    "chan-full?": (id: string) => {
      const ch = channels.get(id);
      if (!ch) return true;
      return ch.isFull();
    },

    // (chan-close ch-id) → boolean (채널 제거)
    "chan-close": (id: string) => {
      return channels.delete(id);
    },
  };
}
