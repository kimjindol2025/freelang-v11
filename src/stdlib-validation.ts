// FreeLang v9: 입력 검증 모듈
// Phase 9: 스키마 기반 데이터 검증 (Django forms 유사)

interface FieldRule {
  type: string;
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
  custom?: (value: any) => boolean;
}

interface SchemaDefinition {
  name: string;
  fields: Record<string, FieldRule>;
}

export function createValidationModule() {
  const schemas = new Map<string, SchemaDefinition>();

  return {
    // schema_define(name, fields) → schema
    "schema_define": (name: string, fields: any): SchemaDefinition => {
      try {
        const schema: SchemaDefinition = { name, fields };
        schemas.set(name, schema);
        return schema;
      } catch (err: any) {
        throw new Error(`schema_define failed: ${err.message}`);
      }
    },

    // schema_validate(schema, data) → {valid: boolean, errors: []}
    "schema_validate": (schemaName: string, data: any): any => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }

        const errors: string[] = [];

        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule as FieldRule);
          errors.push(...fieldErrors);
        }

        return {
          valid: errors.length === 0,
          errors,
          data: errors.length === 0 ? data : null
        };
      } catch (err: any) {
        throw new Error(`schema_validate failed: ${err.message}`);
      }
    },

    // schema_is_valid(schema, data) → boolean
    "schema_is_valid": (schemaName: string, data: any): boolean => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          return false;
        }

        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const errors = validateField(fieldName, value, rule as FieldRule);
          if (errors.length > 0) {
            return false;
          }
        }

        return true;
      } catch (err: any) {
        return false;
      }
    },

    // schema_validate_or_throw(schema, data) → data or throws error
    "schema_validate_or_throw": (schemaName: string, data: any): any => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }

        const errors: string[] = [];

        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule as FieldRule);
          errors.push(...fieldErrors);
        }

        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(", ")}`);
        }

        return data;
      } catch (err: any) {
        throw new Error(`schema_validate_or_throw failed: ${err.message}`);
      }
    },

    // schema_get_errors(schema, data) → [error messages]
    "schema_get_errors": (schemaName: string, data: any): string[] => {
      try {
        const schema = schemas.get(schemaName);
        if (!schema) {
          throw new Error(`Schema not found: ${schemaName}`);
        }

        const errors: string[] = [];

        for (const [fieldName, rule] of Object.entries(schema.fields)) {
          const value = data[fieldName];
          const fieldErrors = validateField(fieldName, value, rule as FieldRule);
          errors.push(...fieldErrors);
        }

        return errors;
      } catch (err: any) {
        throw new Error(`schema_get_errors failed: ${err.message}`);
      }
    },

    // schema_get(name) → schema definition
    "schema_get": (name: string): SchemaDefinition | null => {
      try {
        return schemas.get(name) || null;
      } catch (err: any) {
        throw new Error(`schema_get failed: ${err.message}`);
      }
    },

    // validate_email(email) → boolean
    "validate_email": (email: string): boolean => {
      try {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      } catch {
        return false;
      }
    },

    // validate_string(value, minLen, maxLen) → boolean
    "validate_string": (value: any, minLen?: number, maxLen?: number): boolean => {
      try {
        if (typeof value !== "string") return false;
        if (minLen !== undefined && value.length < minLen) return false;
        if (maxLen !== undefined && value.length > maxLen) return false;
        return true;
      } catch {
        return false;
      }
    },

    // validate_number(value, min, max) → boolean
    "validate_number": (value: any, min?: number, max?: number): boolean => {
      try {
        if (typeof value !== "number") return false;
        if (min !== undefined && value < min) return false;
        if (max !== undefined && value > max) return false;
        return true;
      } catch {
        return false;
      }
    },

    // validate_regex(value, pattern) → boolean
    "validate_regex": (value: any, pattern: string): boolean => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(String(value));
      } catch {
        return false;
      }
    }
  };
}

// 헬퍼 함수: 개별 필드 검증
function validateField(fieldName: string, value: any, rule: FieldRule): string[] {
  const errors: string[] = [];

  // required 체크
  if (rule.required && (value === undefined || value === null || value === "")) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (value === undefined || value === null) {
    return errors;
  }

  // 타입 체크
  if (rule.type === "string" && typeof value !== "string") {
    errors.push(`${fieldName} must be string`);
  } else if (rule.type === "number" && typeof value !== "number") {
    errors.push(`${fieldName} must be number`);
  } else if (rule.type === "integer" && !Number.isInteger(value)) {
    errors.push(`${fieldName} must be integer`);
  } else if (rule.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${fieldName} must be boolean`);
  } else if (rule.type === "email") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push(`${fieldName} must be valid email`);
    }
  }

  // 길이 체크 (문자열)
  if (typeof value === "string") {
    if (rule.min !== undefined && value.length < rule.min) {
      errors.push(`${fieldName} minimum length is ${rule.min}`);
    }
    if (rule.max !== undefined && value.length > rule.max) {
      errors.push(`${fieldName} maximum length is ${rule.max}`);
    }
  }

  // 범위 체크 (숫자)
  if (typeof value === "number") {
    if (rule.min !== undefined && value < rule.min) {
      errors.push(`${fieldName} minimum value is ${rule.min}`);
    }
    if (rule.max !== undefined && value > rule.max) {
      errors.push(`${fieldName} maximum value is ${rule.max}`);
    }
  }

  // 정규식 체크
  if (rule.pattern) {
    try {
      const regex = new RegExp(rule.pattern);
      if (!regex.test(String(value))) {
        errors.push(`${fieldName} does not match pattern`);
      }
    } catch {
      errors.push(`${fieldName} pattern is invalid`);
    }
  }

  return errors;
}
