import { useState, useEffect, useCallback } from "react";
import { Script, Folder, AppState } from "../types";

const STORAGE_KEY = "script-launcher-data";

const defaultState: AppState = {
  scripts: [],
  folders: [],
  scriptFolderMap: {},
};

const exampleScripts: Script[] = [
  {
    id: "example-1",
    name: "Hello World (JS)",
    code: 'console.log("Hello, World!");',
    language: "javascript",
    inputs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function useScriptStore() {
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // 기존 스크립트에 language 필드가 없으면 javascript로 설정
        const scripts = parsed.scripts.map((s: Script) => ({
          ...s,
          language: s.language || "javascript",
        }));
        return { ...parsed, scripts };
      }
    } catch (e) {
      console.error("Failed to load data from localStorage:", e);
    }
    return {
      ...defaultState,
      scripts: exampleScripts,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save data to localStorage:", e);
    }
  }, [state]);

  const addScript = useCallback(
    (script: Omit<Script, "id" | "createdAt" | "updatedAt">) => {
      const newScript: Script = {
        ...script,
        id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setState((prev) => ({
        ...prev,
        scripts: [...prev.scripts, newScript],
      }));
      return newScript;
    },
    []
  );

  const updateScript = useCallback((id: string, updates: Partial<Script>) => {
    setState((prev) => ({
      ...prev,
      scripts: prev.scripts.map((script) =>
        script.id === id
          ? { ...script, ...updates, updatedAt: Date.now() }
          : script
      ),
    }));
  }, []);

  const deleteScript = useCallback((id: string) => {
    setState((prev) => {
      const { [id]: _, ...restMap } = prev.scriptFolderMap;
      return {
        ...prev,
        scripts: prev.scripts.filter((s) => s.id !== id),
        scriptFolderMap: restMap,
      };
    });
  }, []);

  const duplicateScript = useCallback((script: Script) => {
    // 같은 이름의 스크립트 개수 찾기
    const baseName = script.name.replace(/\s*\(\d+\)$/, '');
    const existingNames = state.scripts
      .map(s => s.name)
      .filter(name => name === baseName || name.startsWith(baseName + ' ('));

    let newName = baseName;
    if (existingNames.length > 0) {
      let counter = 1;
      while (existingNames.includes(`${baseName} (${counter})`)) {
        counter++;
      }
      newName = `${baseName} (${counter})`;
    }

    const newScript: Script = {
      ...script,
      id: `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setState((prev) => {
      // 원본 스크립트의 폴더 위치 유지
      const folderId = prev.scriptFolderMap[script.id] ?? null;
      return {
        ...prev,
        scripts: [...prev.scripts, newScript],
        scriptFolderMap: {
          ...prev.scriptFolderMap,
          [newScript.id]: folderId,
        },
      };
    });

    return newScript;
  }, [state.scripts]);

  const addFolder = useCallback(
    (name: string, parentId: string | null = null) => {
      const newFolder: Folder = {
        id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        parentId,
        createdAt: Date.now(),
      };
      setState((prev) => ({
        ...prev,
        folders: [...prev.folders, newFolder],
      }));
      return newFolder;
    },
    []
  );

  const updateFolder = useCallback((id: string, name: string) => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.map((folder) =>
        folder.id === id ? { ...folder, name } : folder
      ),
    }));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setState((prev) => {
      const newScriptFolderMap = { ...prev.scriptFolderMap };
      Object.entries(newScriptFolderMap).forEach(([scriptId, folderId]) => {
        if (folderId === id) {
          newScriptFolderMap[scriptId] = null;
        }
      });

      const folderIdsToDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        prev.folders.forEach((folder) => {
          if (
            folder.parentId &&
            folderIdsToDelete.has(folder.parentId) &&
            !folderIdsToDelete.has(folder.id)
          ) {
            folderIdsToDelete.add(folder.id);
            changed = true;
          }
        });
      }

      return {
        ...prev,
        folders: prev.folders.filter((f) => !folderIdsToDelete.has(f.id)),
        scriptFolderMap: newScriptFolderMap,
      };
    });
  }, []);

  const moveScriptToFolder = useCallback(
    (scriptId: string, folderId: string | null) => {
      setState((prev) => ({
        ...prev,
        scriptFolderMap: {
          ...prev.scriptFolderMap,
          [scriptId]: folderId,
        },
      }));
    },
    []
  );

  // 스크립트를 폴더로 이동하면서 특정 위치에 배치
  const moveScriptToFolderAtPosition = useCallback(
    (scriptId: string, folderId: string | null, targetScriptId: string, position: 'before' | 'after') => {
      setState((prev) => {
        // 1. 폴더 맵 업데이트
        const newScriptFolderMap = {
          ...prev.scriptFolderMap,
          [scriptId]: folderId,
        };

        // 2. 스크립트 순서 재배열
        const movingScript = prev.scripts.find(s => s.id === scriptId);
        if (!movingScript) return prev;

        // 이동할 스크립트를 제외한 나머지
        const scriptsWithoutMoving = prev.scripts.filter(s => s.id !== scriptId);

        // 타겟 스크립트 인덱스 찾기
        const targetIndex = scriptsWithoutMoving.findIndex(s => s.id === targetScriptId);
        if (targetIndex === -1) {
          // 타겟을 찾지 못하면 그냥 끝에 추가
          return {
            ...prev,
            scripts: [...scriptsWithoutMoving, movingScript],
            scriptFolderMap: newScriptFolderMap,
          };
        }

        // 위치에 맞게 삽입
        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        const newScripts = [
          ...scriptsWithoutMoving.slice(0, insertIndex),
          movingScript,
          ...scriptsWithoutMoving.slice(insertIndex),
        ];

        return {
          ...prev,
          scripts: newScripts,
          scriptFolderMap: newScriptFolderMap,
        };
      });
    },
    []
  );

  const getScriptsInFolder = useCallback(
    (folderId: string | null) => {
      return state.scripts.filter((script) => {
        const scriptFolderId = state.scriptFolderMap[script.id] ?? null;
        return scriptFolderId === folderId;
      });
    },
    [state.scripts, state.scriptFolderMap]
  );

  const getSubFolders = useCallback(
    (parentId: string | null) => {
      return state.folders.filter((folder) => folder.parentId === parentId);
    },
    [state.folders]
  );

  const getScript = useCallback(
    (id: string) => {
      return state.scripts.find((s) => s.id === id);
    },
    [state.scripts]
  );

  // 스크립트 순서 변경
  const reorderScripts = useCallback((scriptIds: string[]) => {
    setState((prev) => {
      const scriptMap = new Map(prev.scripts.map((s) => [s.id, s]));
      const reorderedScripts = scriptIds
        .map((id) => scriptMap.get(id))
        .filter((s): s is Script => s !== undefined);

      // 나머지 스크립트 추가 (reorder에 포함되지 않은 것들)
      const reorderedSet = new Set(scriptIds);
      const remainingScripts = prev.scripts.filter(
        (s) => !reorderedSet.has(s.id)
      );

      return {
        ...prev,
        scripts: [...reorderedScripts, ...remainingScripts],
      };
    });
  }, []);

  // 폴더 순서 변경
  const reorderFolders = useCallback((folderIds: string[]) => {
    setState((prev) => {
      const folderMap = new Map(prev.folders.map((f) => [f.id, f]));
      const reorderedFolders = folderIds
        .map((id) => folderMap.get(id))
        .filter((f): f is Folder => f !== undefined);

      // 나머지 폴더 추가 (reorder에 포함되지 않은 것들)
      const reorderedSet = new Set(folderIds);
      const remainingFolders = prev.folders.filter(
        (f) => !reorderedSet.has(f.id)
      );

      return {
        ...prev,
        folders: [...reorderedFolders, ...remainingFolders],
      };
    });
  }, []);

  // 데이터 가져오기 (import)
  const importData = useCallback((data: AppState) => {
    setState(data);
  }, []);

  return {
    state,
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
    getScript,
    reorderScripts,
    reorderFolders,
    importData,
  };
}
