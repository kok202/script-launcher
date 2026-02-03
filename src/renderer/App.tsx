import { useState, useEffect, useCallback, useRef } from "react";
import { Script, ViewMode, ScriptResult } from "./types";
import { useScriptStore } from "./hooks/useScriptStore";
import { ScriptList } from "./components/ScriptList";
import { ScriptEditor } from "./components/ScriptEditor";
import { InputForm } from "./components/InputForm";
import { ResultView } from "./components/ResultView";
import { ScriptPreview } from "./components/ScriptPreview";
import { InputModal } from "./components/InputModal";
import { Settings } from "./components/Settings";
import { BsSun, BsMoon, BsGear } from "react-icons/bs";
import "./styles/index.css";

type Theme = "light" | "dark";
const THEME_KEY = "script-launcher-theme";
const PREVIEW_WIDTH_KEY = "script-launcher-preview-width";
const MIN_PREVIEW_WIDTH = 200;
const COLLAPSE_THRESHOLD = 150;
const DEFAULT_PREVIEW_WIDTH = 350;

function App() {
  const {
    addScript,
    updateScript,
    deleteScript,
    duplicateScript,
    addFolder,
    updateFolder,
    deleteFolder,
    moveScriptToFolder,
    moveScriptToFolderAtPosition,
    getScriptsInFolder,
    getSubFolders,
    state,
    reorderScripts,
    reorderFolders,
    importData,
  } = useScriptStore();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string } | null>(null);

  // Theme
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return (saved as Theme) || "dark";
  });

  // Keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );

  // Preview panel resizing
  const [previewWidth, setPreviewWidth] = useState(() => {
    const saved = localStorage.getItem(PREVIEW_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_PREVIEW_WIDTH;
  });
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Theme effect
  useEffect(() => {
    document.documentElement.className =
      theme === "dark" ? "theme-dark" : "theme-light";
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Save preview width
  useEffect(() => {
    if (!isResizing && previewWidth >= MIN_PREVIEW_WIDTH) {
      localStorage.setItem(PREVIEW_WIDTH_KEY, previewWidth.toString());
    }
  }, [previewWidth, isResizing]);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !resizeRef.current) return;
      const delta = resizeRef.current.startX - e.clientX;
      const newWidth = resizeRef.current.startWidth + delta;

      if (newWidth < COLLAPSE_THRESHOLD) {
        setIsPreviewCollapsed(true);
        setPreviewWidth(0);
      } else {
        setIsPreviewCollapsed(false);
        setPreviewWidth(Math.max(MIN_PREVIEW_WIDTH, newWidth));
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: isPreviewCollapsed ? MIN_PREVIEW_WIDTH : previewWidth,
    };
    if (isPreviewCollapsed) {
      setIsPreviewCollapsed(false);
      setPreviewWidth(MIN_PREVIEW_WIDTH);
    }
  };

  // 플랫 리스트 생성 (키보드 네비게이션용)
  const rootFolders = getSubFolders(null);
  const rootScripts = getScriptsInFolder(null);

  const buildFlatList = useCallback(() => {
    const list: Array<{
      type: "folder" | "script";
      item: Script | { id: string; name: string };
      folderId: string | null;
    }> = [];

    rootFolders.forEach((folder) => {
      list.push({ type: "folder", item: folder, folderId: null });
      if (expandedFolders.has(folder.id)) {
        const folderScripts = state.scripts.filter(
          (s) => state.scriptFolderMap[s.id] === folder.id
        );
        folderScripts.forEach((script) => {
          list.push({ type: "script", item: script, folderId: folder.id });
        });
      }
    });

    rootScripts.forEach((script) => {
      list.push({ type: "script", item: script, folderId: null });
    });

    return list;
  }, [
    rootFolders,
    rootScripts,
    expandedFolders,
    state.scripts,
    state.scriptFolderMap,
  ]);

  const flatList = buildFlatList();

  // 윈도우 이벤트 처리
  useEffect(() => {
    const unsubscribeShown = window.electronAPI?.onWindowShown(() => {
      setViewMode("list");
      setSelectedScript(null);
      setSelectedIndex(0);
      containerRef.current?.focus();
    });

    const unsubscribeHidden = window.electronAPI?.onWindowHidden(() => {
      setResult(null);
    });

    // @ts-expect-error: onToggleSetting is not defined in ElectronAPI, custom method in main process @ref: src/main/preload.ts
    const unsubscribeToggleSettings = window.electronAPI?.onToggleSettings?.(
      () => {
        setViewMode((prev) => (prev === "settings" ? "list" : "settings"));
      }
    );

    return () => {
      unsubscribeShown?.();
      unsubscribeHidden?.();
      unsubscribeToggleSettings?.();
    };
  }, []);

  // 선택된 인덱스에 따라 스크립트 업데이트
  useEffect(() => {
    const current = flatList[selectedIndex];
    if (current?.type === "script") {
      setSelectedScript(current.item as Script);
    } else {
      setSelectedScript(null);
    }
  }, [selectedIndex, flatList]);

  // 리오더 핸들러
  const handleReorderItems = useCallback(
    (
      type: "folder" | "script",
      dragId: string,
      dropId: string,
      position: "before" | "after",
      folderId: string | null
    ) => {
      if (type === "folder") {
        const currentOrder = rootFolders.map((f) => f.id);
        const dragIndex = currentOrder.indexOf(dragId);
        const dropIndex = currentOrder.indexOf(dropId);
        if (dragIndex === -1 || dropIndex === -1) return;

        const newOrder = [...currentOrder];
        newOrder.splice(dragIndex, 1);
        const insertIndex = position === "before" ? dropIndex : dropIndex + 1;
        newOrder.splice(
          insertIndex > dragIndex ? insertIndex - 1 : insertIndex,
          0,
          dragId
        );
        reorderFolders(newOrder);
      } else {
        const scriptsInFolder = state.scripts.filter(
          (s) => (state.scriptFolderMap[s.id] ?? null) === folderId
        );
        const currentOrder = scriptsInFolder.map((s) => s.id);
        const dragIndex = currentOrder.indexOf(dragId);
        const dropIndex = currentOrder.indexOf(dropId);
        if (dragIndex === -1 || dropIndex === -1) return;

        const newOrder = [...currentOrder];
        newOrder.splice(dragIndex, 1);
        const insertIndex = position === "before" ? dropIndex : dropIndex + 1;
        newOrder.splice(
          insertIndex > dragIndex ? insertIndex - 1 : insertIndex,
          0,
          dragId
        );

        const otherScripts = state.scripts
          .filter((s) => (state.scriptFolderMap[s.id] ?? null) !== folderId)
          .map((s) => s.id);
        reorderScripts([...newOrder, ...otherScripts]);
      }
    },
    [
      rootFolders,
      state.scripts,
      state.scriptFolderMap,
      reorderFolders,
      reorderScripts,
    ]
  );

  // 스크립트 실행
  const executeScript = useCallback(
    async (script: Script, inputs: Record<string, string | number>) => {
      setViewMode("result");
      try {
        const res = await window.electronAPI.executeScript(
          script.code,
          inputs,
          script.language
        );
        setResult(res);

        if (res.logs.length === 0 && !res.error) {
          setTimeout(() => {
            window.electronAPI.hideWindow();
          }, 500);
        }
      } catch (error) {
        setResult({
          logs: [],
          result: undefined,
          error:
            error instanceof Error
              ? error.message
              : "실행 중 오류가 발생했습니다.",
        });
      }
    },
    []
  );

  const handleRunScript = useCallback(() => {
    if (!selectedScript) return;

    if (selectedScript.inputs.length > 0) {
      setViewMode("input");
    } else {
      executeScript(selectedScript, {});
    }
  }, [selectedScript, executeScript]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (viewMode !== "list") return;
      if (showFolderModal) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(flatList.length - 1, prev + 1));
          break;
        case "ArrowRight":
        case "ArrowLeft": {
          e.preventDefault();
          const current = flatList[selectedIndex];
          if (current?.type === "folder") {
            const folderId = (current.item as { id: string }).id;
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              if (e.key === "ArrowRight") {
                next.add(folderId);
              } else {
                next.delete(folderId);
              }
              return next;
            });
          }
          break;
        }
        case "Enter":
          e.preventDefault();
          const current = flatList[selectedIndex];
          if (current?.type === "folder") {
            const folderId = (current.item as { id: string }).id;
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              if (next.has(folderId)) {
                next.delete(folderId);
              } else {
                next.add(folderId);
              }
              return next;
            });
          } else if (selectedScript) {
            handleRunScript();
          }
          break;
        case "Escape":
          e.preventDefault();
          window.electronAPI?.hideWindow();
          break;
      }
    },
    [
      viewMode,
      flatList,
      selectedIndex,
      selectedScript,
      showFolderModal,
      handleRunScript,
    ]
  );

  const handleSaveScript = useCallback(
    (script: Script) => {
      if (editingScript?.id) {
        updateScript(editingScript.id, script);
      } else {
        addScript(script);
      }
      setEditingScript(null);
      setViewMode("list");
    },
    [editingScript, updateScript, addScript]
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      addFolder(name, null);
      setShowFolderModal(false);
    },
    [addFolder]
  );

  const themeClass = theme === "dark" ? "theme-dark" : "theme-light";

  return (
    <div
      className={`${themeClass} w-full h-screen flex flex-col rounded-lg shadow-window overflow-hidden outline-none border`}
      style={{
        background: "var(--bg-primary)",
        borderColor: "var(--border)",
      }}
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center px-4 py-3 border-b"
        style={
          {
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
            WebkitAppRegion: "drag",
          } as React.CSSProperties
        }
      >
        <div
          className="flex items-center gap-1.5"
          style={{ color: "var(--text-primary)" }}
        >
          <img
            src={theme === "dark" ? "./logo-white.svg" : "./logo-black.svg"}
            alt="Script Launcher"
            className="w-3 h-3"
          />
          <h1 className="text-sm font-semibold">Script Launcher</h1>
        </div>
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={toggleTheme}
            className="p-1 rounded transition-all hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-secondary)" }}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <BsSun size={14} /> : <BsMoon size={14} />}
          </button>
          <button
            onClick={() =>
              setViewMode((prev) => (prev === "settings" ? "list" : "settings"))
            }
            className="p-1 rounded transition-all hover:bg-[var(--bg-hover)]"
            style={{
              color:
                viewMode === "settings"
                  ? "var(--accent)"
                  : "var(--text-secondary)",
            }}
            title="Settings"
          >
            <BsGear size={14} />
          </button>
          <span
            className="text-[11px] px-2 py-0.5 rounded"
            style={{
              color: "var(--text-hint)",
              background:
                theme === "dark"
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.05)",
            }}
          >
            Option + Space
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {viewMode === "list" && (
          <div className="flex flex-1 overflow-hidden">
            <div
              className="flex flex-col flex-1 min-w-[200px] border-r"
              style={{ borderColor: "var(--border)" }}
            >
              <div
                className="flex justify-between items-center px-2.5 py-1.5 border-b"
                style={{
                  background: "var(--bg-secondary)",
                  borderColor: "var(--border)",
                }}
              >
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Scripts
                </span>
                <div className="flex gap-1">
                  <button
                    className="btn btn-small"
                    onClick={() => {
                      setEditingScript(null);
                      setViewMode("edit");
                    }}
                  >
                    + Script
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() => setShowFolderModal(true)}
                  >
                    + Folder
                  </button>
                </div>
              </div>

              <ScriptList
                folders={rootFolders}
                scripts={rootScripts}
                allScripts={state.scripts}
                allFolders={state.folders}
                scriptFolderMap={state.scriptFolderMap}
                selectedScriptId={selectedScript?.id || null}
                selectedIndex={selectedIndex}
                flatList={flatList}
                expandedFolders={expandedFolders}
                onToggleFolder={(folderId) => {
                  setExpandedFolders((prev) => {
                    const next = new Set(prev);
                    if (next.has(folderId)) {
                      next.delete(folderId);
                    } else {
                      next.add(folderId);
                    }
                    return next;
                  });
                }}
                onSelectIndex={setSelectedIndex}
                onSelectScript={setSelectedScript}
                onEditScript={(script) => {
                  setEditingScript(script);
                  setViewMode("edit");
                }}
                onRunScript={(script) => {
                  setSelectedScript(script);
                  if (script.inputs.length > 0) {
                    setViewMode("input");
                  } else {
                    executeScript(script, {});
                  }
                }}
                onDuplicateScript={duplicateScript}
                onDeleteScript={deleteScript}
                onEditFolder={setEditingFolder}
                onDeleteFolder={deleteFolder}
                onMoveScript={moveScriptToFolder}
                onMoveScriptAtPosition={moveScriptToFolderAtPosition}
                onReorderItems={handleReorderItems}
              />
            </div>

            <div
              className="w-1 cursor-col-resize transition-colors hover:bg-accent"
              onMouseDown={handleResizeStart}
            />

            <div
              className={`flex flex-col overflow-hidden transition-all ${
                isPreviewCollapsed ? "w-0" : ""
              }`}
              style={{ width: isPreviewCollapsed ? 0 : previewWidth }}
            >
              {!isPreviewCollapsed &&
                (selectedScript ? (
                  <ScriptPreview
                    script={selectedScript}
                    onRun={handleRunScript}
                    onEdit={() => {
                      setEditingScript(selectedScript);
                      setViewMode("edit");
                    }}
                  />
                ) : (
                  <div
                    className="flex-1 flex items-center justify-center"
                    style={{ color: "var(--text-hint)" }}
                  >
                    <p className="text-xs">Select a script</p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {viewMode === "edit" && (
          <ScriptEditor
            script={editingScript}
            onSave={handleSaveScript}
            onCancel={() => {
              setEditingScript(null);
              setViewMode("list");
            }}
          />
        )}

        {viewMode === "input" && selectedScript && (
          <InputForm
            script={selectedScript}
            onSubmit={(inputs) => executeScript(selectedScript, inputs)}
            onCancel={() => setViewMode("list")}
          />
        )}

        {viewMode === "result" && (
          <ResultView
            result={result}
            onClose={() => {
              setResult(null);
              setViewMode("list");
            }}
          />
        )}

        {viewMode === "settings" && (
          <Settings
            onClose={() => setViewMode("list")}
            theme={theme}
            onToggleTheme={toggleTheme}
            appData={state}
            onImportData={importData}
          />
        )}
      </div>

      {viewMode === "list" && (
        <div
          className="px-3 py-1.5 text-center border-t"
          style={{
            background: "var(--bg-secondary)",
            borderColor: "var(--border)",
          }}
        >
          <span className="text-[10px]" style={{ color: "var(--text-hint)" }}>
            ↑↓ Move | ←→ Fold/Unfold | Enter Run/Toggle | Esc Close
          </span>
        </div>
      )}

      {showFolderModal && (
        <InputModal
          title="New Folder"
          placeholder="Folder name"
          onSubmit={handleCreateFolder}
          onCancel={() => setShowFolderModal(false)}
        />
      )}

      {editingFolder && (
        <InputModal
          title="Edit Folder"
          placeholder="Folder name"
          initialValue={editingFolder.name}
          submitLabel="Save"
          onSubmit={(name) => {
            updateFolder(editingFolder.id, name);
            setEditingFolder(null);
          }}
          onCancel={() => setEditingFolder(null)}
        />
      )}
    </div>
  );
}

export default App;
