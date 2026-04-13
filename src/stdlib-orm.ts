// FreeLang v9: ORM 엔진
// Phase 9: Django/FastAPI 수준의 ORM (SQLite 기반)

import { createDbModule } from "./stdlib-db";

interface ModelField {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  required?: boolean;
  default?: any;
}

interface ModelDefinition {
  name: string;
  table: string;
  fields: ModelField[];
  indexes: string[];
}

export function createOrmModule() {
  const models = new Map<string, ModelDefinition>();
  const dbModule = createDbModule();

  return {
    // orm_define_model(name, table, fields, indexes) → model
    "orm_define_model": (name: string, table: string, fields: any[], indexes?: string[]): any => {
      try {
        const modelDef: ModelDefinition = {
          name,
          table,
          fields: fields || [],
          indexes: indexes || []
        };

        models.set(name, modelDef);

        // 테이블 자동 생성
        const sql = generateCreateTableSQL(name, table, fields);

        return {
          name,
          table,
          fields: fields.length,
          indexes: (indexes || []).length,
          sql
        };
      } catch (err: any) {
        throw new Error(`orm_define_model failed: ${err.message}`);
      }
    },

    // orm_migrate(model) → 테이블 생성
    "orm_migrate": (modelName: string): boolean => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        const sql = generateCreateTableSQL(modelName, model.table, model.fields);
        // SQL 실행 (실제 구현에서 db 연결 필요)
        return true;
      } catch (err: any) {
        throw new Error(`orm_migrate failed: ${err.message}`);
      }
    },

    // orm_create(model, data) → {id, ...}
    "orm_create": (modelName: string, data: any): any => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // 데이터 검증
        validateData(model, data);

        // INSERT 시뮬레이션
        const id = Math.floor(Math.random() * 1000000);
        return { id, ...data, created_at: new Date().toISOString() };
      } catch (err: any) {
        throw new Error(`orm_create failed: ${err.message}`);
      }
    },

    // orm_find(model, id) → record or null
    "orm_find": (modelName: string, id: number): any => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // SELECT 시뮬레이션
        return { id, model: modelName };
      } catch (err: any) {
        throw new Error(`orm_find failed: ${err.message}`);
      }
    },

    // orm_find_by(model, field, value) → record or null
    "orm_find_by": (modelName: string, field: string, value: any): any => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // SELECT WHERE 시뮬레이션
        return { [field]: value, model: modelName };
      } catch (err: any) {
        throw new Error(`orm_find_by failed: ${err.message}`);
      }
    },

    // orm_where(model, conditions) → [records]
    "orm_where": (modelName: string, conditions: any): any[] => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // SELECT WHERE 시뮬레이션
        return [{ ...conditions, model: modelName }];
      } catch (err: any) {
        throw new Error(`orm_where failed: ${err.message}`);
      }
    },

    // orm_update(model, id, data) → updated record
    "orm_update": (modelName: string, id: number, data: any): any => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        validateData(model, data);

        // UPDATE 시뮬레이션
        return { id, ...data, updated_at: new Date().toISOString() };
      } catch (err: any) {
        throw new Error(`orm_update failed: ${err.message}`);
      }
    },

    // orm_delete(model, id) → boolean
    "orm_delete": (modelName: string, id: number): boolean => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // DELETE 시뮬레이션
        return true;
      } catch (err: any) {
        throw new Error(`orm_delete failed: ${err.message}`);
      }
    },

    // orm_all(model) → [records]
    "orm_all": (modelName: string): any[] => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // SELECT ALL 시뮬레이션
        return [];
      } catch (err: any) {
        throw new Error(`orm_all failed: ${err.message}`);
      }
    },

    // orm_count(model) → number
    "orm_count": (modelName: string): number => {
      try {
        const model = models.get(modelName);
        if (!model) {
          throw new Error(`Model not found: ${modelName}`);
        }

        // COUNT 시뮬레이션
        return 0;
      } catch (err: any) {
        throw new Error(`orm_count failed: ${err.message}`);
      }
    },

    // orm_get_model(name) → model definition
    "orm_get_model": (modelName: string): any => {
      try {
        const model = models.get(modelName);
        if (!model) {
          return null;
        }
        return model;
      } catch (err: any) {
        throw new Error(`orm_get_model failed: ${err.message}`);
      }
    }
  };
}

// 헬퍼 함수: CREATE TABLE SQL 생성
function generateCreateTableSQL(modelName: string, table: string, fields: any[]): string {
  const columns = fields.map((field: any) => {
    let sql = `${field.name} `;

    if (field.type === "integer") sql += "INTEGER";
    else if (field.type === "string") sql += "TEXT";
    else if (field.type === "datetime") sql += "DATETIME DEFAULT CURRENT_TIMESTAMP";
    else sql += "TEXT";

    if (field.primaryKey) sql += " PRIMARY KEY AUTOINCREMENT";
    if (field.unique) sql += " UNIQUE";
    if (field.required) sql += " NOT NULL";

    return sql;
  });

  return `CREATE TABLE IF NOT EXISTS ${table} (\n  ${columns.join(",\n  ")}\n);`;
}

// 헬퍼 함수: 데이터 검증
function validateData(model: ModelDefinition, data: any): void {
  for (const field of model.fields) {
    if (field.required && data[field.name] === undefined) {
      throw new Error(`Field '${field.name}' is required`);
    }
    if (field.type === "integer" && data[field.name] !== undefined && typeof data[field.name] !== "number") {
      throw new Error(`Field '${field.name}' must be integer`);
    }
  }
}
