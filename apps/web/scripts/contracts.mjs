/**
 * Generates src/lib/contracts.ts from /schemas (the engine <-> web contract).
 *
 *   npm run contracts          write the file
 *   npm run contracts:check    fail if the committed file is out of date (CI)
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemas = path.resolve(here, "../../../schemas");
const out = path.resolve(here, "../src/lib/contracts.ts");
const schemasOut = path.resolve(here, "../src/server/schemas.generated.ts");

const banner = `/**
 * GENERATED from /schemas by \`npm run contracts\`. Do not edit by hand.
 * These are the shapes the engine writes and POST /api/ingest/bundle accepts.
 */`;

const ts = await compileFromFile(path.join(schemas, "bundle.schema.json"), {
  cwd: schemas,
  bannerComment: banner,
  declareExternallyReferenced: true,
  additionalProperties: false,
  unreachableDefinitions: true,
  format: true,
  style: { printWidth: 120, semi: true, singleQuote: false, trailingComma: "all" },
  $refOptions: { resolve: { http: false } },
});

// The server validates bundles with the same schemas; inline them so the app never
// reads files outside apps/web at runtime.
const files = (await readdir(schemas)).filter((f) => f.endsWith(".schema.json")).sort();
const inlined = [];
for (const file of files) {
  inlined.push(`  ${JSON.stringify(file)}: ${(await readFile(path.join(schemas, file), "utf8")).trim()},`);
}
const schemasTs = `/* GENERATED from /schemas by \`npm run contracts\`. Do not edit by hand. */\n\nexport const schemas = {\n${inlined.join("\n")}\n} as const;\n`;

const outputs = [
  [out, ts],
  [schemasOut, schemasTs],
];

if (process.argv.includes("--check")) {
  let stale = false;
  for (const [file, content] of outputs) {
    if ((await readFile(file, "utf8").catch(() => "")) !== content) {
      console.error(`${path.relative(process.cwd(), file)} is out of date. Run \`npm run contracts\`.`);
      stale = true;
    }
  }
  if (stale) process.exit(1);
  console.log("Contracts are up to date.");
} else {
  for (const [file, content] of outputs) {
    await writeFile(file, content);
    console.log(`Wrote ${path.relative(process.cwd(), file)}`);
  }
}
