// FreeLang v9 Streaming Output
// Phase 105: AI가 생성한 결과를 토큰 단위로 스트리밍
// (stream-create) → StreamHandle
// (stream-write handle "chunk")
// (stream-end handle)
// (stream-on-chunk handle fn)
// (stream-collect handle) → Promise<string>

import { EventEmitter } from 'events';

export interface StreamChunk {
  index: number;
  content: string;
  done: boolean;
  timestamp: number;
}

export class FLStream extends EventEmitter {
  private chunks: StreamChunk[] = [];
  private chunkIndex = 0;
  private _done = false;
  private _collected = '';

  write(content: string): void {
    if (this._done) return;
    const chunk: StreamChunk = {
      index: this.chunkIndex++,
      content,
      done: false,
      timestamp: Date.now()
    };
    this.chunks.push(chunk);
    this._collected += content;
    this.emit('chunk', chunk);
  }

  end(): void {
    if (this._done) return;
    this._done = true;
    const finalChunk: StreamChunk = {
      index: this.chunkIndex++,
      content: '',
      done: true,
      timestamp: Date.now()
    };
    this.chunks.push(finalChunk);
    this.emit('chunk', finalChunk);
    this.emit('end', this._collected);
  }

  collect(): Promise<string> {
    if (this._done) return Promise.resolve(this._collected);
    return new Promise(resolve => {
      this.once('end', resolve);
    });
  }

  isDone(): boolean { return this._done; }
  getChunks(): StreamChunk[] { return [...this.chunks]; }
  collected(): string { return this._collected; }
  chunkCount(): number { return this.chunks.filter(c => !c.done).length; }
}

// 텍스트를 단어 단위로 스트리밍하는 유틸
export function streamText(stream: FLStream, text: string, delayMs = 0): Promise<void> {
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
      if (delayMs > 0) setTimeout(next, delayMs);
      else next();
    }
    next();
  });
}

// 글로벌 스트림 레지스트리
const streamRegistry = new Map<string, FLStream>();
let streamCounter = 0;

export function createStream(): { id: string; stream: FLStream } {
  const id = `stream-${++streamCounter}`;
  const stream = new FLStream();
  streamRegistry.set(id, stream);
  return { id, stream };
}

export function getStream(id: string): FLStream | null {
  return streamRegistry.get(id) ?? null;
}

export function deleteStream(id: string): boolean {
  return streamRegistry.delete(id);
}
