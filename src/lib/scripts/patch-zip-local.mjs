import fs from "node:fs";
import { injectUniversalInitIntoZip } from "../src/lib/patchers/injectUniversalInit.js";
import { applyDiagnosticOverlayPatch } from "../src/lib/patches/metaZeroFriction.js";

const inPath = process.argv[2];
if (!inPath) {
  console.error("Usage: node scripts/patch-zip-local.mjs <path/to/build.zip>");
  process.exit(1);
}

const zipBuf = fs.readFileSync(inPath);

// load scripts from repo
const universalInit = fs.readFileSync("src/lib/scripts/universal-init.js", "utf8");
const overlay = fs.readFileSync("src/lib/scripts/diagnostic-overlay.js", "utf8");

const uni = await injectUniversalInitIntoZip(zipBuf, universalInit);
let patched = uni.patchedZip;

const ov = await applyDiagnosticOverlayPatch(patched, overlay, "BASIC");
patched = ov.patchedZip;

fs.writeFileSync("patched-output.zip", patched);

console.log("UNIVERSAL:", uni.result);
console.log("OVERLAY:", ov.patch);
console.log("Wrote patched-output.zip");