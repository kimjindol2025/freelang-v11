/**
 * Create the file I/O module for FreeLang
 * Provides: file_read, file_write, file_exists, file_delete, file_append
 *           dir_create, dir_list, dir_delete, file_copy
 */
export declare function createFileModule(): {
    file_read: (filePath: string) => string;
    file_write: (filePath: string, content: string) => boolean;
    file_exists: (filePath: string) => boolean;
    file_delete: (filePath: string) => boolean;
    file_append: (filePath: string, content: string) => boolean;
    file_copy: (src: string, dest: string) => boolean;
    dir_create: (dirPath: string) => boolean;
    dir_list: (dirPath: string) => string[];
    dir_delete: (dirPath: string) => boolean;
    file_size: (filePath: string) => number;
    file_is_file: (filePath: string) => boolean;
    file_is_dir: (filePath: string) => boolean;
    file_mtime: (filePath: string) => number;
    file_ctime: (filePath: string) => number;
};
//# sourceMappingURL=stdlib-file.d.ts.map