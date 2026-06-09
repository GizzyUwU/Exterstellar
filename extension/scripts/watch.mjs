import * as esbuild from "esbuild";
import {readdirSync} from "fs";

const plugins = readdirSync("plugins").filter(f => f.endsWith(".ts")).map(f => `plugins/${f}`);

const shared = {bundle: true, format: "iife", target: "es2020", sourcemap: true};

const contexts = await Promise.all([
  esbuild.context({...shared, entryPoints: plugins, outdir: "dist/plugins"}),
  esbuild.context({...shared, entryPoints: ["content.ts"], outfile: "dist/content.js"}),
  esbuild.context({...shared, entryPoints: ["popup.ts"], outfile: "dist/popup.js"}),
  esbuild.context({...shared, entryPoints: ["importer.ts"], outfile: "dist/importer.js"}),
]);

await Promise.all(contexts.map(c => c.watch()));
console.log("[Exterstellar | Watch] Watching...");