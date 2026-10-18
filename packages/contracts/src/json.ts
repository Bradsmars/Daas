import { types } from 'node:util';
import { visit } from 'jsonc-parser';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ValidationIssue = { path: string; code: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export const JSON_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxDepth: 32, maxMembers: 10_000, maxStringLength: 8_192 });

class JsonValidationError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function reject(code: string): never {
  throw new JsonValidationError(code);
}

function failure(error: unknown, fallback: string): Result<never> {
  // Generic JSON has no schema-known field names; arbitrary keys must not enter diagnostics.
  return { ok: false, issues: [{ path: '', code: error instanceof JsonValidationError ? error.code : fallback }] };
}

function checkString(value: string): void {
  if (value.length > JSON_LIMITS.maxStringLength) reject('json_string_limit');
  if (!value.isWellFormed()) reject('json_invalid_unicode');
}

function dataProperty(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) reject('json_sparse_array');
  if (!('value' in descriptor)) reject('json_accessor');
  if (!descriptor.enumerable) reject('json_non_enumerable');
  return descriptor.value as unknown;
}

/** Validate data without calling getters/toJSON, cloning it, or changing its values. */
export function inspectJson(value: unknown): Result<JsonValue> {
  const ancestors = new Set<object>();
  let bytes = 0;
  let members = 0;

  function addBytes(count: number): void {
    bytes += count;
    if (bytes > JSON_LIMITS.maxBytes) reject('json_byte_limit');
  }

  function stringBytes(text: string): number {
    checkString(text);
    return Buffer.byteLength(JSON.stringify(text), 'utf8');
  }

  function inspect(current: unknown, parentDepth: number): void {
    if (current === null || typeof current === 'boolean') {
      addBytes(current === null ? 4 : current ? 4 : 5);
      return;
    }
    if (typeof current === 'string') {
      addBytes(stringBytes(current));
      return;
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current)) reject('json_non_finite');
      addBytes(Buffer.byteLength(String(current), 'utf8'));
      return;
    }
    if (typeof current !== 'object') reject('json_invalid_type');
    if (types.isProxy(current)) reject('json_non_plain_object');

    const depth = parentDepth + 1;
    if (depth > JSON_LIMITS.maxDepth) reject('json_depth_limit');
    if (ancestors.has(current)) reject('json_cycle');
    const array = Array.isArray(current);
    const prototype: unknown = Object.getPrototypeOf(current);
    if (prototype !== null && prototype !== (array ? Array.prototype : Object.prototype)) reject('json_non_plain_object');
    ancestors.add(current);

    const keys = Reflect.ownKeys(current);
    if (keys.some((key) => typeof key === 'symbol')) reject('json_symbol_key');

    if (array) {
      const items = current as unknown[];
      addBytes(2 + Math.max(0, items.length - 1));
      if (keys.length !== items.length + 1) reject('json_sparse_or_extended_array');
      for (const key of keys) {
        if (key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= items.length)) {
          reject('json_array_property');
        }
      }
      for (let index = 0; index < items.length; index++) inspect(dataProperty(items, String(index)), depth);
    } else {
      members += keys.length;
      if (members > JSON_LIMITS.maxMembers) reject('json_member_limit');
      addBytes(2 + Math.max(0, keys.length - 1));
      for (const key of keys) {
        if (typeof key !== 'string') reject('json_symbol_key');
        addBytes(stringBytes(key) + 1);
        inspect(dataProperty(current, key), depth);
      }
    }
    ancestors.delete(current);
  }

  try {
    inspect(value, 0);
    return { ok: true, value: value as JsonValue };
  } catch (error) {
    return failure(error, 'json_invalid_value');
  }
}

/** Check raw syntax, decoded duplicate keys and nesting before ordinary parsing. */
export function parseJson(text: string): Result<JsonValue> {
  try {
    if (typeof text !== 'string') reject('json_invalid_type');
    if (Buffer.byteLength(text, 'utf8') > JSON_LIMITS.maxBytes) reject('json_byte_limit');
    const containers: (Set<string> | null)[] = [];
    let members = 0;

    function begin(object: boolean): void {
      if (containers.length >= JSON_LIMITS.maxDepth) reject('json_depth_limit');
      containers.push(object ? new Set<string>() : null);
    }

    visit(text, {
      onObjectBegin: () => begin(true),
      onArrayBegin: () => begin(false),
      onObjectEnd: () => { containers.pop(); },
      onArrayEnd: () => { containers.pop(); },
      onObjectProperty: (key) => {
        checkString(key);
        const keys = containers.at(-1);
        if (!keys) reject('json_syntax');
        if (keys.has(key)) reject('json_duplicate_key');
        keys.add(key);
        if (++members > JSON_LIMITS.maxMembers) reject('json_member_limit');
      },
      onLiteralValue: (literal: unknown) => {
        if (typeof literal === 'string') checkString(literal);
        if (typeof literal === 'number' && !Number.isFinite(literal)) reject('json_non_finite');
      },
      onError: () => reject('json_syntax'),
    }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });

    return inspectJson(JSON.parse(text) as unknown);
  } catch (error) {
    return failure(error, 'json_syntax');
  }
}
