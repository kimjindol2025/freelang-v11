export interface FLExample {
    concept: string;
    code: string;
    description: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
}
export interface LessonResult {
    concept: string;
    examples: FLExample[];
    explanation: string;
    exercise: string;
}
export declare const FL_EXAMPLES: FLExample[];
export declare class FLTutor {
    private examples;
    constructor(examples?: FLExample[]);
    findByConcept(concept: string): FLExample[];
    findByTag(tag: string): FLExample[];
    findByDifficulty(level: FLExample['difficulty']): FLExample[];
    lesson(concept: string): LessonResult;
    random(): FLExample;
    concepts(): string[];
    addExample(example: FLExample): void;
    size(): number;
    lessonMarkdown(concept: string): string;
}
export declare const globalTutor: FLTutor;
//# sourceMappingURL=fl-tutor.d.ts.map