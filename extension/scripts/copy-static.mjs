import { cpSync, existsSync, mkdirSync } from "fs";

export const STATIC_FILES = ["manifest.json", "popup.html", "popup.css", "importer.html"];
export const STATIC_DIRS = ["images"];

export function copyStatic() {
  mkdirSync("dist", {recursive: true});

  for (const file of STATIC_FILES) {
    if (existsSync(file)) {
      cpSync(file, `dist/${file}`);
    }
  }

  for (const dir of STATIC_DIRS) {
    if (existsSync(dir)) {
      cpSync(dir, `dist/${dir}`, {recursive: true});
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  copyStatic();
  console.log("[Exterstellar | Build] Copied static files to dist/");
}