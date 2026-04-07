/**
 * Create the data transform module for FreeLang v9
 */
export declare function createDataModule(): {
    json_get: (obj: any, path: string) => any;
    json_set: (obj: any, path: string, value: any) => any;
    json_merge: (obj1: any, obj2: any) => any;
    json_deep_merge: (obj1: any, obj2: any) => any;
    json_keys: (obj: any) => string[];
    json_vals: (obj: any) => any[];
    json_str: (obj: any) => string;
    json_pretty: (obj: any) => string;
    json_has: (obj: any, key: string) => boolean;
    json_del: (obj: any, key: string) => any;
    csv_parse: (str: string) => string[][];
    csv_write: (rows: string[][]) => string;
    csv_header: (rows: string[][]) => string[];
    csv_to_objects: (rows: string[][]) => Record<string, string>[];
    str_template: (template: string, vars: Record<string, any>) => string;
    str_lines: (str: string) => string[];
    str_join_lines: (lines: string[]) => string;
    str_trim: (str: string) => string;
    str_words: (str: string) => string[];
    str_count: (str: string, sub: string) => number;
};
//# sourceMappingURL=stdlib-data.d.ts.map