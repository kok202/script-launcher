import { useState } from 'react';
import { Script, Folder } from '../types';
import { VscFolder, VscFolderOpened, VscEdit, VscTrash, VscChevronRight, VscChevronDown, VscPlay, VscCopy } from 'react-icons/vsc';
import { SiJavascript, SiPython } from 'react-icons/si';
import { VscTerminalBash } from 'react-icons/vsc';

interface FlatListItem {
  type: 'folder' | 'script';
  item: Script | { id: string; name: string };
  folderId: string | null;
}

interface ScriptListProps {
  folders: Folder[];
  scripts: Script[];
  allScripts: Script[];
  allFolders: Folder[];
  scriptFolderMap: Record<string, string | null>;
  selectedScriptId: string | null;
  selectedIndex: number;
  flatList: FlatListItem[];
  expandedFolders: Set<string>;
  onToggleFolder: (folderId: string) => void;
  onSelectIndex: (index: number) => void;
  onSelectScript: (script: Script | null) => void;
  onEditScript: (script: Script) => void;
  onRunScript: (script: Script) => void;
  onDuplicateScript: (script: Script) => void;
  onDeleteScript: (id: string) => void;
  onEditFolder: (folder: { id: string; name: string }) => void;
  onDeleteFolder: (id: string) => void;
  onMoveScript: (scriptId: string, folderId: string | null) => void;
  onMoveScriptAtPosition: (scriptId: string, folderId: string | null, targetScriptId: string, position: 'before' | 'after') => void;
  onReorderItems: (type: 'folder' | 'script', dragId: string, dropId: string, position: 'before' | 'after', folderId: string | null) => void;
}

export function ScriptList({
  folders,
  scripts,
  allScripts,
  scriptFolderMap,
  selectedIndex,
  flatList,
  expandedFolders,
  onToggleFolder,
  onSelectIndex,
  onSelectScript,
  onEditScript,
  onRunScript,
  onDuplicateScript,
  onDeleteScript,
  onEditFolder,
  onDeleteFolder,
  onMoveScript,
  onMoveScriptAtPosition,
  onReorderItems,
}: ScriptListProps) {
  const [dragItem, setDragItem] = useState<{ type: 'folder' | 'script'; id: string; folderId: string | null } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' | 'inside'; folderId: string | null } | null>(null);

  const getScriptsInFolder = (folderId: string) => {
    return allScripts.filter(s => scriptFolderMap[s.id] === folderId);
  };

  const getScriptIcon = (script: Script) => {
    if (script.language === 'python') {
      return <SiPython size={14} className="text-python" />;
    }
    if (script.language === 'shell') {
      return <VscTerminalBash size={14} className="text-shell" />;
    }
    return <SiJavascript size={14} className="text-js" />;
  };

  // Find flat list index for an item
  const getFlatIndex = (type: 'folder' | 'script', id: string) => {
    return flatList.findIndex(item => item.type === type && (item.item as { id: string }).id === id);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, type: 'folder' | 'script', id: string, folderId: string | null) => {
    setDragItem({ type, id, folderId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, id, folderId }));
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, _targetType: 'folder' | 'script', position: 'before' | 'after' | 'inside', folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragItem) return;

    // 폴더 안으로 드롭할 때는 스크립트만 가능
    if (position === 'inside' && dragItem.type === 'folder') return;

    // 같은 아이템 위에는 드롭 불가
    if (dragItem.id === targetId) {
      setDropTarget(null);
      return;
    }

    // 스크립트를 다른 폴더의 스크립트 사이로 드래그 가능하게 허용
    setDropTarget({ id: targetId, position, folderId });
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetType: 'folder' | 'script', folderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();

    if (!dragItem || !dropTarget) {
      setDragItem(null);
      setDropTarget(null);
      return;
    }

    // 폴더 안으로 드롭 (스크립트를 폴더로 이동)
    if (dropTarget.position === 'inside' && targetType === 'folder' && dragItem.type === 'script') {
      onMoveScript(dragItem.id, targetId);
    }
    // 순서 재정렬
    else if (dropTarget.position === 'before' || dropTarget.position === 'after') {
      if (dragItem.type === 'script' && targetType === 'script') {
        // 같은 폴더 내에서 순서 변경
        if (dragItem.folderId === folderId) {
          onReorderItems('script', dragItem.id, targetId, dropTarget.position, folderId);
        } else {
          // 다른 폴더로 이동하면서 특정 위치에 배치
          onMoveScriptAtPosition(dragItem.id, folderId, targetId, dropTarget.position);
        }
      } else if (dragItem.type === 'folder' && targetType === 'folder') {
        onReorderItems('folder', dragItem.id, targetId, dropTarget.position, null);
      } else if (dragItem.type === 'script' && targetType === 'folder') {
        // 스크립트를 폴더 앞/뒤로 드래그하면 루트로 이동
        onMoveScript(dragItem.id, null);
      }
    }

    setDragItem(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDropTarget(null);
  };

  const renderScript = (script: Script, indent: number = 0, folderId: string | null = null) => {
    const flatIndex = getFlatIndex('script', script.id);
    const isSelected = flatIndex === selectedIndex;
    const isDropBefore = dropTarget?.id === script.id && dropTarget?.position === 'before';
    const isDropAfter = dropTarget?.id === script.id && dropTarget?.position === 'after';

    return (
      <div
        key={`script-${script.id}`}
        className={`
          group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors
          ${isSelected ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'}
          ${isDropBefore ? 'border-t-2 border-accent' : ''}
          ${isDropAfter ? 'border-b-2 border-accent' : ''}
        `}
        style={{ paddingLeft: `${8 + indent * 20}px` }}
        onClick={() => {
          onSelectIndex(flatIndex);
          onSelectScript(script);
        }}
        draggable
        onDragStart={(e) => handleDragStart(e, 'script', script.id, folderId)}
        onDragOver={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          const position = e.clientY < midY ? 'before' : 'after';
          handleDragOver(e, script.id, 'script', position, folderId);
        }}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, script.id, 'script', folderId)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-shrink-0 w-4 flex items-center justify-center">
          {getScriptIcon(script)}
        </div>
        <span className="flex-1 truncate text-xs" style={{ color: 'var(--text-primary)' }}>
          {script.name}
        </span>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
          <button
            className="action-btn"
            onClick={() => onRunScript(script)}
            title="Run"
          >
            <VscPlay size={12} />
          </button>
          <button
            className="action-btn"
            onClick={() => onEditScript(script)}
            title="Edit"
          >
            <VscEdit size={12} />
          </button>
          <button
            className="action-btn"
            onClick={() => onDuplicateScript(script)}
            title="Duplicate"
          >
            <VscCopy size={12} />
          </button>
          <button
            className="action-btn danger"
            onClick={() => {
              if (confirm('Delete this script?')) {
                onDeleteScript(script.id);
              }
            }}
            title="Delete"
          >
            <VscTrash size={12} />
          </button>
        </div>
      </div>
    );
  };

  const renderFolder = (folder: Folder) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderScripts = getScriptsInFolder(folder.id);
    const flatIndex = getFlatIndex('folder', folder.id);
    const isSelected = flatIndex === selectedIndex;
    const isDropInside = dropTarget?.id === folder.id && dropTarget?.position === 'inside';
    const isDropBefore = dropTarget?.id === folder.id && dropTarget?.position === 'before';
    const isDropAfter = dropTarget?.id === folder.id && dropTarget?.position === 'after';

    return (
      <div key={`folder-${folder.id}`}>
        <div
          className={`
            group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors
            ${isSelected ? 'bg-[var(--bg-selected)]' : 'hover:bg-[var(--bg-hover)]'}
            ${isDropInside ? 'bg-accent/20 ring-1 ring-accent' : ''}
            ${isDropBefore ? 'border-t-2 border-accent' : ''}
            ${isDropAfter ? 'border-b-2 border-accent' : ''}
          `}
          onClick={() => {
            onSelectIndex(flatIndex);
            onToggleFolder(folder.id);
          }}
          draggable
          onDragStart={(e) => handleDragStart(e, 'folder', folder.id, null)}
          onDragOver={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const thirdHeight = rect.height / 3;
            let position: 'before' | 'after' | 'inside';
            if (e.clientY < rect.top + thirdHeight) {
              position = 'before';
            } else if (e.clientY > rect.bottom - thirdHeight) {
              position = 'after';
            } else {
              position = 'inside';
            }
            handleDragOver(e, folder.id, 'folder', position, null);
          }}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id, 'folder', null)}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-shrink-0 w-4 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            {isExpanded ? <VscChevronDown size={12} /> : <VscChevronRight size={12} />}
          </div>
          <div className="flex-shrink-0 w-4 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            {isExpanded ? <VscFolderOpened size={14} /> : <VscFolder size={14} />}
          </div>
          <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
            {folder.name}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-hint)', background: 'var(--bg-hover)' }}>
            {folderScripts.length}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(folder);
              }}
              title="Edit"
            >
              <VscEdit size={12} />
            </button>
            <button
              className="action-btn danger"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this folder and all its contents?')) {
                  onDeleteFolder(folder.id);
                }
              }}
              title="Delete"
            >
              <VscTrash size={12} />
            </button>
          </div>
        </div>
        {isExpanded && folderScripts.length > 0 && (
          <div className="border-l ml-4" style={{ borderColor: 'var(--border)' }}>
            {folderScripts.map(script => renderScript(script, 1, folder.id))}
          </div>
        )}
      </div>
    );
  };

  if (folders.length === 0 && scripts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8" style={{ color: 'var(--text-hint)' }}>
        <p className="text-sm">No scripts yet</p>
        <p className="text-xs mt-1">Add a new script to get started</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto py-1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        // 루트로 드롭할 때 스크립트를 루트로 이동
        if (dragItem?.type === 'script') {
          onMoveScript(dragItem.id, null);
        }
        setDragItem(null);
        setDropTarget(null);
      }}
    >
      {folders.map(folder => renderFolder(folder))}
      {scripts.map(script => renderScript(script, 0, null))}
    </div>
  );
}
