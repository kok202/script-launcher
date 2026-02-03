import { useState, useEffect, useRef } from "react";
import {
  VscChevronLeft,
  VscCheck,
  VscError,
  VscCloudDownload,
  VscCloudUpload,
} from "react-icons/vsc";
import { BsSun, BsMoon } from "react-icons/bs";
import { AppState } from "../types";

interface SettingsProps {
  onClose: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  appData: AppState;
  onImportData: (data: AppState) => void;
}

const SHORTCUT_OPTIONS = [
  { label: "Option + Space", value: "Alt+Space" },
  { label: "Option + S", value: "Alt+S" },
  { label: "Option + L", value: "Alt+L" },
  { label: "Control + Space", value: "Control+Space" },
  { label: "Control + Shift + S", value: "Control+Shift+S" },
  { label: "Command + Shift + S", value: "CommandOrControl+Shift+S" },
];

const SIZE_PRESETS = [
  { label: "Custom", value: "" },
  { label: "600 × 450", value: "600x450" },
  { label: "600 × 600", value: "600x600" },
  { label: "800 × 450", value: "800x450" },
  { label: "800 × 600", value: "800x600" },
  { label: "800 × 800", value: "800x800" },
  { label: "1000 × 500", value: "1000x500" },
  { label: "1000 × 600", value: "1000x600" },
  { label: "1000 × 800", value: "1000x800" },
];

const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;

export function Settings({
  onClose,
  theme,
  onToggleTheme,
  appData,
  onImportData,
}: SettingsProps) {
  const [shortcut, setShortcut] = useState("Alt+Space");
  const [windowWidth, setWindowWidth] = useState(800);
  const [windowHeight, setWindowHeight] = useState(450);
  const [sizePreset, setSizePreset] = useState("800x450");
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = (await window.electronAPI.getSettings()) as any;
      setShortcut(settings.shortcut);
      if (settings.windowWidth) setWindowWidth(settings.windowWidth);
      if (settings.windowHeight) setWindowHeight(settings.windowHeight);

      // Check if matches a preset
      const preset = SIZE_PRESETS.find(
        (p) =>
          p.value ===
          `${settings.windowWidth || 800}x${settings.windowHeight || 450}`
      );
      setSizePreset(preset ? preset.value : "");
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  };

  const handlePresetChange = (preset: string) => {
    setSizePreset(preset);
    if (preset) {
      const [w, h] = preset.split("x").map(Number);
      setWindowWidth(w);
      setWindowHeight(h);
    }
  };

  const handleWidthChange = (value: number) => {
    const width = Math.max(MIN_WIDTH, value);
    setWindowWidth(width);
    // Check if matches preset
    const preset = SIZE_PRESETS.find(
      (p) => p.value === `${width}x${windowHeight}`
    );
    setSizePreset(preset ? preset.value : "");
  };

  const handleHeightChange = (value: number) => {
    const height = Math.max(MIN_HEIGHT, value);
    setWindowHeight(height);
    // Check if matches preset
    const preset = SIZE_PRESETS.find(
      (p) => p.value === `${windowWidth}x${height}`
    );
    setSizePreset(preset ? preset.value : "");
  };

  const handleSave = async () => {
    setStatus("saving");
    try {
      const success = await window.electronAPI.saveSettings({
        shortcut,
        windowWidth: Math.max(MIN_WIDTH, windowWidth),
        windowHeight: Math.max(MIN_HEIGHT, windowHeight),
      } as any);
      if (success) {
        setStatus("success");
        setMessage("Settings saved!");
      } else {
        setStatus("error");
        setMessage("Shortcut may be in use by another app.");
      }
    } catch (e) {
      setStatus("error");
      setMessage("Failed to save settings.");
    }

    setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 3000);
  };

  const handleExport = () => {
    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      data: appData,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `script-launcher-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus("success");
    setMessage("Data exported successfully!");
    setTimeout(() => {
      setStatus("idle");
      setMessage("");
    }, 3000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // 데이터 유효성 검사
        const importedData = parsed.data || parsed;
        if (!importedData.scripts || !Array.isArray(importedData.scripts)) {
          throw new Error("Invalid data format: scripts not found");
        }

        // scripts에 language 필드가 없으면 javascript로 설정
        const processedData: AppState = {
          scripts: importedData.scripts.map((s: Record<string, unknown>) => ({
            ...s,
            language: s.language || "javascript",
          })),
          folders: importedData.folders || [],
          scriptFolderMap: importedData.scriptFolderMap || {},
        };

        if (
          confirm(
            `Import ${processedData.scripts.length} scripts and ${processedData.folders.length} folders?\n\nThis will replace all existing data.`
          )
        ) {
          onImportData(processedData);
          setStatus("success");
          setMessage("Data imported successfully!");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Failed to import: Invalid file format");
        console.error("Import error:", err);
      }

      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    };

    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <button type="button" className="action-btn" onClick={onClose}>
          <VscChevronLeft size={16} />
        </button>
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Settings
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-4">
          {/* Theme Setting */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Theme
            </label>
            <button
              className="flex items-center gap-1.5 px-2 py-1.5 rounded border w-fit transition-colors text-[11px]"
              style={{
                background: "var(--bg-secondary)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              onClick={onToggleTheme}
            >
              {theme === "dark" ? <BsMoon size={12} /> : <BsSun size={12} />}
              <span>{theme === "dark" ? "Dark" : "Light"}</span>
            </button>
          </div>

          {/* Shortcut Setting */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Toggle Shortcut
            </label>
            <select
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              className="input input-sm w-44"
            >
              {SHORTCUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Window Size Setting */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Window Size
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                className="input input-sm w-16"
                value={windowWidth}
                onChange={(e) =>
                  handleWidthChange(parseInt(e.target.value) || MIN_WIDTH)
                }
                min={MIN_WIDTH}
                placeholder="Width"
              />
              <span className="text-[10px]" style={{ color: "var(--text-hint)" }}>
                ×
              </span>
              <input
                type="number"
                className="input input-sm w-16"
                value={windowHeight}
                onChange={(e) =>
                  handleHeightChange(parseInt(e.target.value) || MIN_HEIGHT)
                }
                min={MIN_HEIGHT}
                placeholder="Height"
              />
              <select
                value={sizePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="input input-sm w-28"
              >
                {SIZE_PRESETS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[9px]" style={{ color: "var(--text-hint)" }}>
              Min: {MIN_WIDTH} × {MIN_HEIGHT}
            </p>
          </div>

          {/* Data Export/Import */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Data Backup
            </label>
            <div className="flex items-center gap-1.5">
              <button
                className="btn btn-small flex items-center gap-1"
                onClick={handleExport}
              >
                <VscCloudDownload size={12} />
                <span>Export</span>
              </button>
              <button
                className="btn btn-small flex items-center gap-1"
                onClick={handleImportClick}
              >
                <VscCloudUpload size={12} />
                <span>Import</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
            <p className="text-[9px]" style={{ color: "var(--text-hint)" }}>
              {appData.scripts.length} scripts, {appData.folders.length} folders
            </p>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] ${
                status === "success"
                  ? "bg-green-500/10 text-green-500"
                  : "bg-red-500/10 text-red-500"
              }`}
            >
              {status === "success" && <VscCheck size={12} />}
              {status === "error" && <VscError size={12} />}
              <span>{message}</span>
            </div>
          )}

          {/* Save Button */}
          <div>
            <button
              className="btn btn-small btn-primary"
              onClick={handleSave}
              disabled={status === "saving"}
            >
              {status === "saving" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-3 py-1.5 border-t text-center"
        style={{ borderColor: "var(--border)" }}
      >
        <p className="text-[9px]" style={{ color: "var(--text-hint)" }}>
          Script Launcher v1.0.0
        </p>
      </div>
    </div>
  );
}
