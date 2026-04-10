type CallFn = (name: string, args: any[]) => any;
export declare function createPubSubModule(callFn: CallFn): {
    pubsub_subscribe: (topic: string, handlerName: string) => string;
    pubsub_once: (topic: string, handlerName: string) => string;
    pubsub_publish: (topic: string, data: any) => number;
    pubsub_unsubscribe: (subscriptionId: string) => boolean;
    pubsub_unsubscribe_all: (topic: string) => number;
    pubsub_topics: () => string[];
    pubsub_subscribers: (topic: string) => number;
    pubsub_clear: () => number;
};
export {};
//# sourceMappingURL=stdlib-pubsub.d.ts.map