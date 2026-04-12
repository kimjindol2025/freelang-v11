import { EventEmitter } from 'events';
export interface StreamChunk {
    index: number;
    content: string;
    done: boolean;
    timestamp: number;
}
export declare class FLStream extends EventEmitter {
    private chunks;
    private chunkIndex;
    private _done;
    private _collected;
    write(content: string): void;
    end(): void;
    collect(): Promise<string>;
    isDone(): boolean;
    getChunks(): StreamChunk[];
    collected(): string;
    chunkCount(): number;
}
export declare function streamText(stream: FLStream, text: string, delayMs?: number): Promise<void>;
export declare function createStream(): {
    id: string;
    stream: FLStream;
};
export declare function getStream(id: string): FLStream | null;
export declare function deleteStream(id: string): boolean;
//# sourceMappingURL=streaming.d.ts.map