export interface Entity {
    id: string;
    type: string;
    properties: Record<string, unknown>;
    confidence: number;
    lastUpdated: Date;
}
export interface Relation {
    id: string;
    from: string;
    to: string;
    type: string;
    strength: number;
    bidirectional: boolean;
}
export interface WorldState {
    entities: Map<string, Entity>;
    relations: Relation[];
    facts: Map<string, unknown>;
    rules: WorldRule[];
    timestamp: Date;
    version: number;
}
export interface WorldRule {
    id: string;
    condition: string;
    consequence: string;
    confidence: number;
}
export interface WorldUpdate {
    type: 'add-entity' | 'update-entity' | 'remove-entity' | 'add-relation' | 'add-fact' | 'add-rule';
    data: unknown;
    source: string;
    timestamp: Date;
}
export declare class WorldModel {
    private state;
    private history;
    private _idCounter;
    constructor();
    private nextId;
    private recordUpdate;
    addEntity(entity: Omit<Entity, 'lastUpdated'>): Entity;
    updateEntity(id: string, props: Partial<Entity['properties']>): Entity | null;
    removeEntity(id: string): boolean;
    getEntity(id: string): Entity | null;
    addRelation(relation: Omit<Relation, 'id'>): Relation;
    getRelations(entityId: string): Relation[];
    findPath(fromId: string, toId: string): string[];
    setFact(key: string, value: unknown): void;
    getFact(key: string): unknown;
    addRule(rule: Omit<WorldRule, 'id'>): WorldRule;
    applyRules(): WorldUpdate[];
    query(type?: string, minConfidence?: number): Entity[];
    snapshot(): WorldState;
    diff(other: WorldState): WorldUpdate[];
    getHistory(): WorldUpdate[];
    summarize(): string;
}
export declare const globalWorldModel: WorldModel;
//# sourceMappingURL=world-model.d.ts.map