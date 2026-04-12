export declare class Channel {
    private queue;
    private maxSize;
    constructor(size?: number);
    /** 값을 채널에 보냄. 가득 차면 false 반환 */
    send(val: any): boolean;
    /** 채널에서 값을 꺼냄. 비어있으면 null 반환 */
    recv(): any;
    size(): number;
    isEmpty(): boolean;
    isFull(): boolean;
}
export declare function createChannelModule(): Record<string, Function>;
//# sourceMappingURL=stdlib-channel.d.ts.map