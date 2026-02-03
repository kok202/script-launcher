import { ScriptResult } from '../types';
import { VscError, VscOutput, VscCheck, VscChevronLeft } from 'react-icons/vsc';

interface ResultViewProps {
  result: ScriptResult | null;
  onClose: () => void;
}

export function ResultView({ result, onClose }: ResultViewProps) {
  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-hint)' }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Running...</span>
        </div>
      </div>
    );
  }

  const hasOutput = result.logs.length > 0 || result.error;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <button type="button" className="action-btn" onClick={onClose}>
          <VscChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Result
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {result.error && (
          <div
            className="rounded-md p-3 border"
            style={{ background: 'rgba(255, 69, 58, 0.1)', borderColor: 'rgba(255, 69, 58, 0.3)' }}
          >
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-danger mb-2">
              <VscError size={14} />
              Error
            </h3>
            <pre
              className="text-xs font-mono whitespace-pre-wrap break-words"
              style={{ color: 'var(--text-primary)' }}
            >
              {result.error}
            </pre>
          </div>
        )}

        {result.logs.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              <VscOutput size={14} />
              Output
            </h3>
            <div
              className="rounded-md p-3 max-h-[400px] overflow-y-auto"
              style={{ background: 'var(--bg-secondary)' }}
            >
              {result.logs.map((log, index) => (
                <pre
                  key={index}
                  className="text-xs font-mono whitespace-pre-wrap break-words py-0.5"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {log}
                </pre>
              ))}
            </div>
          </div>
        )}

        {!hasOutput && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8" style={{ color: 'var(--text-hint)' }}>
            <VscCheck size={24} className="text-green-500" />
            <p className="text-sm">Script executed successfully</p>
            <p className="text-xs">(No output)</p>
          </div>
        )}
      </div>
    </div>
  );
}
