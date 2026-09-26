import "server-only";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { Bundle, Event, JobCompletion, RunnerHeartbeat } from "@/lib/contracts";
import { schemas } from "./schemas.generated";

let ajv: Ajv2020 | null = null;
const compiled = new Map<string, ValidateFunction>();

function validator<T>(ref: string): ValidateFunction<T> {
  const cached = compiled.get(ref);
  if (cached) return cached as ValidateFunction<T>;
  if (!ajv) {
    ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    for (const schema of Object.values(schemas)) ajv.addSchema(schema as object);
  }
  const fn = ajv.getSchema<T>(ref);
  if (!fn) throw new Error(`Schema ${ref} failed to compile`);
  compiled.set(ref, fn);
  return fn;
}

function describe(error: ErrorObject): string {
  const where = error.instancePath || "(root)";
  const extra = error.keyword === "additionalProperties" ? ` (${String(error.params.additionalProperty)})` : "";
  return `${where} ${error.message ?? "is invalid"}${extra}`;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function check<T>(ref: string, data: unknown): Validation<T> {
  const validate = validator<T>(ref);
  if (validate(data)) return { ok: true, value: data };
  return { ok: false, errors: (validate.errors ?? []).slice(0, 20).map(describe) };
}

const JOB = schemas["job.schema.json"].$id;

export type BundleValidation = { ok: true; bundle: Bundle } | { ok: false; errors: string[] };

/** Validate a pushed bundle against /schemas/bundle.schema.json (and everything it references). */
export function validateBundle(data: unknown): BundleValidation {
  const result = check<Bundle>(schemas["bundle.schema.json"].$id, data);
  return result.ok ? { ok: true, bundle: result.value } : result;
}

/** One line of a runner's event batch: /schemas/event.schema.json. */
export const validateEvent = (data: unknown) => check<Event>(schemas["event.schema.json"].$id, data);

/** Runner heartbeat and job completion bodies: /schemas/job.schema.json#/$defs. */
export const validateHeartbeat = (data: unknown) => check<RunnerHeartbeat>(`${JOB}#/$defs/heartbeat`, data);
export const validateCompletion = (data: unknown) => check<JobCompletion>(`${JOB}#/$defs/completion`, data);
