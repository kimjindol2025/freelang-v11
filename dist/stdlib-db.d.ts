export declare function createDbModule(): {
    db_get: (collection: string, id: string) => any;
    db_all: (collection: string) => any[];
    db_put: (collection: string, id: string, data: any) => any;
    db_delete: (collection: string, id: string) => boolean;
    db_project: (name: string) => any;
    db_projects: () => any[];
    db_query: (dbPath: string, sql: string, params?: any[]) => any[];
    db_exec: (dbPath: string, sql: string) => string;
    db_insert: (dbPath: string, table: string, data: Record<string, any>) => boolean;
    db_update: (dbPath: string, table: string, data: Record<string, any>, where: string) => boolean;
    db_delete_row: (dbPath: string, table: string, where: string) => boolean;
    db_count: (dbPath: string, table: string) => number;
    db_tables: (dbPath: string) => string[];
    db_create: (dbPath: string, sql: string) => boolean;
};
//# sourceMappingURL=stdlib-db.d.ts.map