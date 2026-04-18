// FreeLang v9: Pub/Sub Event System Standard Library
// Phase 21: Decoupled event-driven communication for server services

type CallFn = (name: string, args: any[]) => any;

interface Subscription {
  id: string;
  handlerName: string;
  once: boolean;
}

// Global topic registry
const _topics = new Map<string, Subscription[]>();
let _subCounter = 0;

export function createPubSubModule(callFn: CallFn) {
  return {
    // pubsub_subscribe topic handlerName → subscriptionId
    "pubsub_subscribe": (topic: string, handlerName: string): string => {
      const id = `sub_${++_subCounter}`;
      if (!_topics.has(topic)) _topics.set(topic, []);
      _topics.get(topic)!.push({ id, handlerName, once: false });
      return id;
    },

    // pubsub_once topic handlerName → subscriptionId (auto-unsubscribes after first fire)
    "pubsub_once": (topic: string, handlerName: string): string => {
      const id = `sub_${++_subCounter}`;
      if (!_topics.has(topic)) _topics.set(topic, []);
      _topics.get(topic)!.push({ id, handlerName, once: true });
      return id;
    },

    // pubsub_publish topic data → delivered count
    "pubsub_publish": (topic: string, data: any): number => {
      const subs = _topics.get(topic);
      if (!subs || subs.length === 0) return 0;
      let count = 0;
      const toRemove: string[] = [];
      for (const sub of subs) {
        try {
          callFn(sub.handlerName, [topic, data]);
          count++;
        } catch {}
        if (sub.once) toRemove.push(sub.id);
      }
      if (toRemove.length > 0) {
        const remaining = subs.filter(s => !toRemove.includes(s.id));
        if (remaining.length === 0) _topics.delete(topic);
        else _topics.set(topic, remaining);
      }
      return count;
    },

    // pubsub_unsubscribe subscriptionId → boolean
    "pubsub_unsubscribe": (subscriptionId: string): boolean => {
      for (const [topic, subs] of _topics) {
        const idx = subs.findIndex(s => s.id === subscriptionId);
        if (idx !== -1) {
          subs.splice(idx, 1);
          if (subs.length === 0) _topics.delete(topic);
          return true;
        }
      }
      return false;
    },

    // pubsub_unsubscribe_all topic → removed count
    "pubsub_unsubscribe_all": (topic: string): number => {
      const subs = _topics.get(topic);
      if (!subs) return 0;
      const count = subs.length;
      _topics.delete(topic);
      return count;
    },

    // pubsub_topics → string[] (active topics with at least one subscriber)
    "pubsub_topics": (): string[] => Array.from(_topics.keys()),

    // pubsub_subscribers topic → number
    "pubsub_subscribers": (topic: string): number => {
      return _topics.get(topic)?.length ?? 0;
    },

    // pubsub_clear → total removed
    "pubsub_clear": (): number => {
      let total = 0;
      for (const subs of _topics.values()) total += subs.length;
      _topics.clear();
      return total;
    },
  };
}
