// world-model.ts — FreeLang v9 Phase 141: [WORLD-MODEL]
// AI가 세계에 대한 내부 모델을 구축하고 업데이트하는 시스템
// 엔티티, 관계, 상태, 규칙을 추적

export interface Entity {
  id: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;   // 0~1
  lastUpdated: Date;
}

export interface Relation {
  id: string;
  from: string;         // Entity id
  to: string;           // Entity id
  type: string;         // "is-a", "has", "causes", "part-of", etc.
  strength: number;     // 0~1
  bidirectional: boolean;
}

export interface WorldState {
  entities: Map<string, Entity>;
  relations: Relation[];
  facts: Map<string, unknown>;   // key→value 사실
  rules: WorldRule[];
  timestamp: Date;
  version: number;
}

export interface WorldRule {
  id: string;
  condition: string;    // 조건 설명
  consequence: string;  // 결과 설명
  confidence: number;
}

export interface WorldUpdate {
  type: 'add-entity' | 'update-entity' | 'remove-entity' | 'add-relation' | 'add-fact' | 'add-rule';
  data: unknown;
  source: string;       // 업데이트 출처
  timestamp: Date;
}

export class WorldModel {
  private state: WorldState;
  private history: WorldUpdate[];
  private _idCounter: number = 0;

  constructor() {
    this.state = {
      entities: new Map(),
      relations: [],
      facts: new Map(),
      rules: [],
      timestamp: new Date(),
      version: 0,
    };
    this.history = [];
  }

  private nextId(prefix: string = 'id'): string {
    return `${prefix}-${++this._idCounter}-${Date.now()}`;
  }

  private recordUpdate(update: WorldUpdate): void {
    this.history.push(update);
    this.state.timestamp = new Date();
    this.state.version++;
  }

  // 엔티티 추가
  addEntity(entity: Omit<Entity, 'lastUpdated'>): Entity {
    const e: Entity = {
      ...entity,
      lastUpdated: new Date(),
    };
    this.state.entities.set(e.id, e);
    this.recordUpdate({
      type: 'add-entity',
      data: e,
      source: 'world-model',
      timestamp: new Date(),
    });
    return e;
  }

  // 엔티티 업데이트
  updateEntity(id: string, props: Partial<Entity['properties']>): Entity | null {
    const e = this.state.entities.get(id);
    if (!e) return null;
    const updated: Entity = {
      ...e,
      properties: { ...e.properties, ...props },
      lastUpdated: new Date(),
    };
    this.state.entities.set(id, updated);
    this.recordUpdate({
      type: 'update-entity',
      data: { id, props },
      source: 'world-model',
      timestamp: new Date(),
    });
    return updated;
  }

  // 엔티티 삭제
  removeEntity(id: string): boolean {
    const existed = this.state.entities.has(id);
    if (!existed) return false;
    this.state.entities.delete(id);
    // 관련 관계도 제거
    this.state.relations = this.state.relations.filter(
      r => r.from !== id && r.to !== id
    );
    this.recordUpdate({
      type: 'remove-entity',
      data: { id },
      source: 'world-model',
      timestamp: new Date(),
    });
    return true;
  }

  // 엔티티 조회
  getEntity(id: string): Entity | null {
    return this.state.entities.get(id) ?? null;
  }

  // 관계 추가
  addRelation(relation: Omit<Relation, 'id'>): Relation {
    const r: Relation = {
      ...relation,
      id: this.nextId('rel'),
    };
    this.state.relations.push(r);
    this.recordUpdate({
      type: 'add-relation',
      data: r,
      source: 'world-model',
      timestamp: new Date(),
    });
    return r;
  }

  // 엔티티의 관계 조회
  getRelations(entityId: string): Relation[] {
    return this.state.relations.filter(
      r => r.from === entityId || (r.bidirectional && r.to === entityId)
    );
  }

  // BFS로 두 엔티티 간 경로 찾기
  findPath(fromId: string, toId: string): string[] {
    if (fromId === toId) return [fromId];

    const visited = new Set<string>();
    const queue: { id: string; path: string[] }[] = [{ id: fromId, path: [fromId] }];

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);

      const neighbors = this.state.relations
        .filter(r => r.from === id || (r.bidirectional && r.to === id))
        .map(r => (r.from === id ? r.to : r.from));

      for (const neighbor of neighbors) {
        if (neighbor === toId) return [...path, neighbor];
        if (!visited.has(neighbor)) {
          queue.push({ id: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return []; // 경로 없음
  }

  // 사실 저장
  setFact(key: string, value: unknown): void {
    this.state.facts.set(key, value);
    this.recordUpdate({
      type: 'add-fact',
      data: { key, value },
      source: 'world-model',
      timestamp: new Date(),
    });
  }

  // 사실 조회
  getFact(key: string): unknown {
    return this.state.facts.get(key) ?? null;
  }

  // 규칙 추가
  addRule(rule: Omit<WorldRule, 'id'>): WorldRule {
    const r: WorldRule = {
      ...rule,
      id: this.nextId('rule'),
    };
    this.state.rules.push(r);
    this.recordUpdate({
      type: 'add-rule',
      data: r,
      source: 'world-model',
      timestamp: new Date(),
    });
    return r;
  }

  // 규칙 적용 (조건 기반으로 사실 추론)
  applyRules(): WorldUpdate[] {
    const applied: WorldUpdate[] = [];
    for (const rule of this.state.rules) {
      // 간단한 규칙 엔진: 조건과 일치하는 엔티티에 결과 적용
      for (const [, entity] of this.state.entities) {
        // 엔티티 타입이나 속성에서 조건 검색
        const condLower = rule.condition.toLowerCase();
        const entityStr = JSON.stringify(entity).toLowerCase();
        if (entityStr.includes(condLower)) {
          // 결과를 사실로 기록
          const factKey = `rule:${rule.id}:${entity.id}`;
          if (!this.state.facts.has(factKey)) {
            this.setFact(factKey, {
              rule: rule.id,
              entity: entity.id,
              consequence: rule.consequence,
              confidence: rule.confidence * entity.confidence,
            });
            applied.push({
              type: 'add-fact',
              data: { key: factKey, consequence: rule.consequence },
              source: `rule:${rule.id}`,
              timestamp: new Date(),
            });
          }
        }
      }
    }
    return applied;
  }

  // 타입/신뢰도 기반 쿼리
  query(type?: string, minConfidence?: number): Entity[] {
    let results = Array.from(this.state.entities.values());
    if (type !== undefined) {
      results = results.filter(e => e.type === type);
    }
    if (minConfidence !== undefined) {
      results = results.filter(e => e.confidence >= minConfidence);
    }
    return results;
  }

  // 상태 스냅샷 (깊은 복사)
  snapshot(): WorldState {
    return {
      entities: new Map(
        Array.from(this.state.entities.entries()).map(([k, v]) => [k, { ...v, properties: { ...v.properties } }])
      ),
      relations: this.state.relations.map(r => ({ ...r })),
      facts: new Map(this.state.facts),
      rules: this.state.rules.map(r => ({ ...r })),
      timestamp: new Date(this.state.timestamp),
      version: this.state.version,
    };
  }

  // 두 상태 비교 → 차이 WorldUpdate 목록 반환
  diff(other: WorldState): WorldUpdate[] {
    const updates: WorldUpdate[] = [];
    const now = new Date();

    // 현재 상태에 없는 엔티티 (other에만 있는 것)
    for (const [id, entity] of other.entities) {
      if (!this.state.entities.has(id)) {
        updates.push({ type: 'add-entity', data: entity, source: 'diff', timestamp: now });
      }
    }

    // 현재 상태에 있지만 다른 엔티티
    for (const [id, entity] of this.state.entities) {
      const otherEntity = other.entities.get(id);
      if (!otherEntity) {
        updates.push({ type: 'remove-entity', data: { id }, source: 'diff', timestamp: now });
      } else if (JSON.stringify(entity.properties) !== JSON.stringify(otherEntity.properties)) {
        updates.push({ type: 'update-entity', data: { id, props: otherEntity.properties }, source: 'diff', timestamp: now });
      }
    }

    // 새로운 관계
    for (const rel of other.relations) {
      const exists = this.state.relations.find(r => r.id === rel.id);
      if (!exists) {
        updates.push({ type: 'add-relation', data: rel, source: 'diff', timestamp: now });
      }
    }

    // 새로운 사실
    for (const [key, value] of other.facts) {
      if (!this.state.facts.has(key)) {
        updates.push({ type: 'add-fact', data: { key, value }, source: 'diff', timestamp: now });
      }
    }

    return updates;
  }

  // 업데이트 이력 반환
  getHistory(): WorldUpdate[] {
    return [...this.history];
  }

  // 세계 요약 문자열 생성
  summarize(): string {
    const entityCount = this.state.entities.size;
    const relationCount = this.state.relations.length;
    const factCount = this.state.facts.size;
    const ruleCount = this.state.rules.length;

    const types = new Map<string, number>();
    for (const e of this.state.entities.values()) {
      types.set(e.type, (types.get(e.type) ?? 0) + 1);
    }

    const typeStr = Array.from(types.entries())
      .map(([t, c]) => `${t}(${c})`)
      .join(', ');

    const avgConfidence = entityCount > 0
      ? (Array.from(this.state.entities.values()).reduce((s, e) => s + e.confidence, 0) / entityCount).toFixed(2)
      : '0.00';

    return [
      `WorldModel v${this.state.version}`,
      `Entities: ${entityCount} [${typeStr || 'none'}]`,
      `Relations: ${relationCount}`,
      `Facts: ${factCount}`,
      `Rules: ${ruleCount}`,
      `Avg Confidence: ${avgConfidence}`,
      `Last Updated: ${this.state.timestamp.toISOString()}`,
    ].join(' | ');
  }
}

// 전역 WorldModel 인스턴스
export const globalWorldModel = new WorldModel();
