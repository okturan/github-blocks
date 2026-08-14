#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, "examples/out");
const readme = await readFile(join(root, "README.md"), "utf8");
const siteHtml = await readFile(join(root, "site/index.html"), "utf8");
const siteApp = await readFile(join(root, "site/app.mjs"), "utf8");
const outputNames = (await readdir(outputDirectory))
  .filter((name) => name.endsWith(".svg"))
  .sort();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(outputNames.length === 11, `Expected eleven rendered examples, found ${outputNames.length}`);

for (const name of outputNames) {
  const svg = await readFile(join(outputDirectory, name), "utf8");
  assert(/^(?:<\?xml[^>]*>\s*)?<svg\b/.test(svg), `${name} is not an SVG document`);
  assert(/\bwidth="\d+"/.test(svg) && /\bheight="\d+"/.test(svg), `${name} is missing intrinsic dimensions`);
  assert(!/<script\b|javascript:/i.test(svg), `${name} contains executable script content`);
  if (["cinematic-strip.svg", "poster-cards.svg", "media-list.svg", "classic-cards.svg"].includes(name)) {
    const inlinedCovers = svg.match(/<image href="data:image\/jpeg;base64,/g) ?? [];
    assert(inlinedCovers.length === 3, `${name} must contain three inlined sample covers`);
  }
}

const galleryOutputs = [...readme.matchAll(/src="\.\/examples\/out\/([^"/]+\.svg)"/g)]
  .map((match) => match[1]);
assert(galleryOutputs.length === 6, `Expected six README gallery outputs, found ${galleryOutputs.length}`);
assert(new Set(galleryOutputs).size === galleryOutputs.length, "README gallery outputs must be unique");
for (const name of galleryOutputs) {
  assert(outputNames.includes(name), `README gallery references missing output: ${name}`);
}

assert(outputNames.includes("commit-life.svg"), "examples/out is missing commit-life.svg");
assert(outputNames.includes("commit-life-light.svg"), "examples/out is missing commit-life-light.svg");
assert(galleryOutputs.includes("commit-life.svg"), "README gallery is missing commit-life.svg");
assert(
  /#commit-life/.test(readme) && /#lane-defense/.test(readme),
  "README gallery should deep-link graph blocks to the configurator",
);
assert(
  /data-kind="life" data-id="commit-life"/.test(siteHtml),
  "Configurator sidebar is missing the commit-life block",
);
assert(/id="ship-verb"/.test(siteHtml), "Configurator ship lede cannot be updated per block");
assert(
  /id="how-bake"/.test(siteHtml) && /id="how-det"/.test(siteHtml) && /id="how-extra"/.test(siteHtml),
  "Configurator how-it-works facts cannot be updated per block",
);
assert(
  /import \{ commitLife \} from "\.\/blocks\/commit-life\.mjs"/.test(siteApp),
  "Configurator does not import the commit-life renderer",
);
assert(
  /data-kind="habits" data-id="coding-habits"/.test(siteHtml),
  "Configurator sidebar is missing the coding-habits block",
);
assert(/id="view-habits"/.test(siteHtml), "Configurator is missing the coding-habits view");
assert(/id="habits-yaml"/.test(siteHtml), "Configurator is missing the coding-habits workflow output");
assert(/id="hero-title"/.test(siteHtml) && /id="hero-lede"/.test(siteHtml), "Configurator hero cannot be updated");
assert(
  /import \{ codingHabits \} from "\.\/blocks\/coding-habits\.mjs"/.test(siteApp),
  "Configurator does not import the coding-habits renderer",
);
assert(
  /fetchRecentPublicCommits/.test(siteApp) && /analyzeCodingHabits/.test(siteApp),
  "Configurator does not load and analyze recent commits",
);
for (const kind of ["defense", "habits", "media", "life"]) {
  assert(new RegExp(`\\b${kind}: \\{`).test(siteApp), `Configurator hero is missing ${kind} copy`);
}
assert(/updateHero\(kind\)/.test(siteApp), "Configurator does not update the hero when a block is selected");
for (const [name, content] of [["README.md", readme], ["site/index.html", siteHtml], ["site/app.mjs", siteApp]]) {
  assert(!content.includes("—"), `${name} contains an em dash`);
}

console.log(`Verified ${outputNames.length} SVG outputs, ${galleryOutputs.length} gallery embeds, and the coding-habits configurator`);
