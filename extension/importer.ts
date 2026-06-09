import type { ExportPayload } from "./types";

function multipleBoxShadow(n: number): string {
  const rand = () => Math.floor(Math.random() * 2000);
  let v = `${rand()}px ${rand()}px #FFF`;
  for (let i = 2; i <= n; i++) v += `, ${rand()}px ${rand()}px #FFF`;
  return v;
}

const style = document.createElement("style");
style.textContent = `
  #stars {box-shadow: ${multipleBoxShadow(700)};}
  #stars2 {box-shadow: ${multipleBoxShadow(200)};}
  #stars3 {box-shadow: ${multipleBoxShadow(100)};}
  #stars::after {box-shadow: ${multipleBoxShadow(700)};}
  #stars2::after {box-shadow: ${multipleBoxShadow(200)};}
  #stars3::after {box-shadow: ${multipleBoxShadow(100)};}
`;
document.head.appendChild(style);

const pickBtn = document.getElementById("pick") as HTMLButtonElement;
const input = document.getElementById("import-file") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLSpanElement;

function setStatus(msg: string, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#f87171" : "#6b7280";
}

function readImportFile(file: File) {
  setStatus("Reading file...");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = (e.target as FileReader).result as string;
      const data = JSON.parse(raw) as Partial<ExportPayload>;
      if (!data.exterstellar) {
        setStatus("Not a valid Exterstellar settings file.", true);
        return;
      }

      const toSave: Partial<ExportPayload> = {};
      if (data.pluginStates) toSave.pluginStates = data.pluginStates;
      if (data.pluginConfig) toSave.pluginConfig = data.pluginConfig;
      if (data.managerSettings) toSave.managerSettings = data.managerSettings;

      setStatus("Saving...");
      chrome.storage.sync.set(toSave, () => {
        setStatus("Done. Closing...");
        setTimeout(() => window.close(), 600);
      });
    } catch {
      setStatus("Failed to parse file. Is it a valid JSON export?", true);
    }
  };
  reader.readAsText(file);
}

pickBtn.addEventListener("click", () => {
  input.value = "";
  input.click();
});

input.addEventListener("change", () => {
  const file = input.files?.[0];
  if (!file) return;
  readImportFile(file);
});