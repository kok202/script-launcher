import { Script } from '../types';
import { VscPlay, VscEdit, VscCode, VscTerminalBash } from 'react-icons/vsc';
import { SiJavascript, SiPython } from 'react-icons/si';

interface ScriptPreviewProps {
  script: Script;
  onRun: () => void;
  onEdit: () => void;
}

export function ScriptPreview({ script, onRun, onEdit }: ScriptPreviewProps) {
  const getLangIcon = () => {
    if (script.language === 'python') {
      return <SiPython size={14} className="text-python" />;
    }
    if (script.language === 'shell') {
      return <VscTerminalBash size={14} className="text-shell" />;
    }
    return <SiJavascript size={14} className="text-js" />;
  };

  const getLangLabel = () => {
    if (script.language === 'python') return 'Python';
    if (script.language === 'shell') return 'Shell';
    return 'JavaScript';
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <VscCode size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {script.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {getLangIcon()}
          <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            {getLangLabel()}
          </span>
        </div>
      </div>

      {/* Code Preview */}
      <div className="flex-1 overflow-y-auto p-3">
        <pre
          className="text-xs font-mono whitespace-pre-wrap break-words leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
        >
          {script.code}
        </pre>
      </div>

      {/* Parameters */}
      {script.inputs.length > 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 border-t flex-wrap"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>
            Parameters:
          </span>
          {script.inputs.map(input => (
            <span
              key={input.name}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-hint)' }}
            >
              {input.name}: {input.type}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex justify-end gap-2 px-3 py-2 border-t"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <button className="btn btn-small" onClick={onEdit}>
          <VscEdit size={12} />
          <span>Edit</span>
        </button>
        <button className="btn btn-small btn-primary" onClick={onRun}>
          <VscPlay size={12} />
          <span>Run</span>
        </button>
      </div>
    </div>
  );
}
