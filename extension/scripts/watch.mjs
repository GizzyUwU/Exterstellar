import * as esbuild from "esbuild";
import {existsSync, watch, readdirSync} from "fs";
import { copyStatic, STATIC_FILES, STATIC_DIRS } from "./copy-static.mjs";

const plugins = readdirSync("plugins").filter(f => f.endsWith(".ts")).map(f => `plugins/${f}`);

const shared = {bundle: true, format: "iife", target: "es2020", sourcemap: true};

const contexts = await Promise.all([
  esbuild.context({...shared, entryPoints: plugins, outdir: "dist/plugins"}),
  esbuild.context({...shared, entryPoints: ["content.ts"], outfile: "dist/content.js"}),
  esbuild.context({...shared, entryPoints: ["popup.ts"], outfile: "dist/popup.js"}),
  esbuild.context({...shared, entryPoints: ["importer.ts"], outfile: "dist/importer.js"}),
  esbuild.context({...shared, entryPoints: ["onboarding.ts"], outfile: "dist/onboarding.js"}),
]);

await Promise.all(contexts.map(c => c.watch()));

copyStatic();

for (const file of STATIC_FILES) {
  if (existsSync(file)) {
    watch(file, () => {
      copyStatic();
      console.log(`[Exterstellar | Watch] Copied ${file} -> dist/`);
    });
  }
}

for (const dir of STATIC_DIRS) {
  if (existsSync(dir)) {
    watch(dir, {recursive: true}, () => {
      copyStatic();
      console.log(`[Exterstellar | Watch] Copied ${dir}/ -> dist/`);
    });
  }
}

console.log("[Exterstellar | Watch] Watching...");