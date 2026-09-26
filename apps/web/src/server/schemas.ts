import "server-only";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { Bundle } from "@/lib/contracts";
import { schemas } from "./schemas.generated";

let bundleValidator: ValidateFunction<Bundle> | null = null;

function validator(): ValidateFunction<Bundle> {
  if (bundleValidator) return bundleValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const schema of Object.values(schemas)) ajv.addSchema(schema as object);
  const compiled = ajv.getSchema<Bundle>(schemas["bundle.schema.json"].$id);
  if (!compiled) throw new Error("bundle.schema.json failed to compile");
  bundleValidator = compiled;
  return compiled;
}

function describe(error: ErrorObject): string {
  const where = error.instancePath || "(root)";
  const extra = error.keyword === "additionalProperties" ? ` (${String(error.params.additionalProperty)})` : "";
  return `${where} ${error.message ?? "is invalid"}${extra}`;
}

export type BundleValidation = { ok: true; bundle: Bundle } | { ok: false; errors: string[] };

/** Validate a pushed bundle against /schemas/bundle.schema.json (and everything it references). */
export function validateBundle(data: unknown): BundleValidation {
  const validate = validator();
  if (validate(data)) return { ok: true, bundle: data };
  return { ok: false, errors: (validate.errors ?? []).slice(0, 20).map(describe) };
}
