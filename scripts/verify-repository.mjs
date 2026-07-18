#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "examples/out");
const readme = await readFile(join(root, "README.md"), "utf8");
const outputNames = (await readdir(outputDirectory))
  .filter((name) => name.endsWith(".svg"))
  .sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(outputNames.length === 8, `Expected eight rendered examples, found ${outputNames.length}`);

for (const name of outputNames) {
  const svg = await readFile(join(outputDirectory, name), "utf8");
  assert(/^(?:<\?xml[^>]*>\s*)?<svg\b/.test(svg), `${name} is not an SVG document`);
  assert(/\bwidth="\d+"/.test(svg) && /\bheight="\d+"/.test(svg), `${name} is missing intrinsic dimensions`);
  assert(!/<script\b|javascript:/i.test(svg), `${name} contains executable script content`);
}

const galleryOutputs = [...readme.matchAll(/src="\.\/examples\/out\/([^"/]+\.svg)"/g)]
  .map((match) => match[1]);
assert(galleryOutputs.length === 4, `Expected four README gallery outputs, found ${galleryOutputs.length}`);
assert(new Set(galleryOutputs).size === galleryOutputs.length, "README gallery outputs must be unique");
for (const name of galleryOutputs) {
  assert(outputNames.includes(name), `README gallery references missing output: ${name}`);
}

console.log(`Verified ${outputNames.length} deterministic SVG outputs and ${galleryOutputs.length} README gallery embeds`);
