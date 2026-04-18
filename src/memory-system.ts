// FreeLang v9 Memory System — Phase 101
// [REMEMBER :key "..." :value $x :ttl :forever]   → 장기 메모리
// [RECALL :key "..." :fallback $default]            → 조회
// [EPISODE :id "..." :what "..." :when now]         → 에피소드 기록
// [WORKING :set $x] / [WORKING :get]               → 단기 작업 메모리

export type MemoryScope = 'long-term' | 'short-term' | 'episode';

export interface MemoryEntry {
  key: string;
  value: any;
  scope: MemoryScope;
  ttl: number | 'forever';      // ms or 'forever'
  createdAt: number;
  accessCount: number;
  tags: string[];
}

export interface Episode {
  id: string;
  what: string;
  when: number;
  context: any;
  outcome?: any;
}

export class MemorySystem {
  private longTerm: Map<string, MemoryEntry> = new Map();
  private shortTerm: Map<string, MemoryEntry> = new Map();
  private episodes: Episode[] = [];
  private working: any = null;

  // 저장
  remember(key: string, value: any, options: {
    scope?: MemoryScope;
    ttl?: number | 'forever';
    tags?: string[];
  } = {}): void {
    const entry: MemoryEntry = {
      key,
      value,
      scope: options.scope ?? 'long-term',
      ttl: options.ttl ?? 'forever',
      createdAt: Date.now(),
      accessCount: 0,
      tags: options.tags ?? []
    };
    if (entry.scope === 'short-term') {
      this.shortTerm.set(key, entry);
    } else {
      this.longTerm.set(key, entry);
    }
  }

  // 조회
  recall(key: string, fallback: any = null): any {
    const entry = this.longTerm.get(key) ?? this.shortTerm.get(key);
    if (!entry) return fallback;
    // TTL 확인
    if (entry.ttl !== 'forever' && Date.now() - entry.createdAt > entry.ttl) {
      this.longTerm.delete(key);
      this.shortTerm.delete(key);
      return fallback;
    }
    entry.accessCount++;
    return entry.value;
  }

  // 삭제
  forget(key: string): boolean {
    return this.longTerm.delete(key) || this.shortTerm.delete(key);
  }

  // 에피소드 기록
  recordEpisode(id: string, what: string, context: any = {}, outcome?: any): Episode {
    const ep: Episode = { id, what, when: Date.now(), context, outcome };
    this.episodes.push(ep);
    return ep;
  }

  // 에피소드 검색
  searchEpisodes(query: string): Episode[] {
    return this.episodes.filter(ep => ep.what.includes(query) || ep.id.includes(query));
  }

  // 단기 작업 메모리
  setWorking(value: any): void { this.working = value; }
  getWorking(): any { return this.working; }
  clearWorking(): void { this.working = null; }

  // 태그로 검색
  searchByTag(tag: string): MemoryEntry[] {
    return [...this.longTerm.values(), ...this.shortTerm.values()]
      .filter(e => e.tags.includes(tag));
  }

  // 모든 키 목록
  keys(scope?: MemoryScope): string[] {
    if (scope === 'short-term') return [...this.shortTerm.keys()];
    if (scope === 'long-term') return [...this.longTerm.keys()];
    return [...this.longTerm.keys(), ...this.shortTerm.keys()];
  }

  // 단기 메모리 만료된 것 정리
  purgeExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [k, e] of this.shortTerm) {
      if (e.ttl !== 'forever' && now - e.createdAt > e.ttl) {
        this.shortTerm.delete(k);
        count++;
      }
    }
    // 장기 메모리도 만료 확인
    for (const [k, e] of this.longTerm) {
      if (e.ttl !== 'forever' && now - e.createdAt > e.ttl) {
        this.longTerm.delete(k);
        count++;
      }
    }
    return count;
  }

  stats(): { longTerm: number; shortTerm: number; episodes: number } {
    return {
      longTerm: this.longTerm.size,
      shortTerm: this.shortTerm.size,
      episodes: this.episodes.length
    };
  }

  // 전체 초기화 (테스트 용도)
  clear(): void {
    this.longTerm.clear();
    this.shortTerm.clear();
    this.episodes = [];
    this.working = null;
  }
}

// 글로벌 메모리 인스턴스
export const globalMemory = new MemorySystem();
