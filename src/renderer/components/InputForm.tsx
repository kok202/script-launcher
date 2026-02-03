import { useState, useEffect, useRef } from 'react';
import { Script } from '../types';
import { VscPlay, VscChevronLeft } from 'react-icons/vsc';

interface InputFormProps {
  script: Script;
  onSubmit: (inputs: Record<string, string | number>) => void;
  onCancel: () => void;
}

export function InputForm({ script, onSubmit, onCancel }: InputFormProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    script.inputs.forEach(input => {
      defaults[input.name] = input.defaultValue?.toString() || '';
    });
    setValues(defaults);

    setTimeout(() => {
      firstInputRef.current?.focus();
    }, 100);
  }, [script]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const processedInputs: Record<string, string | number> = {};
    script.inputs.forEach(input => {
      const value = values[input.name] || '';
      if (input.type === 'number') {
        processedInputs[input.name] = parseFloat(value) || 0;
      } else {
        processedInputs[input.name] = value;
      }
    });

    onSubmit(processedInputs);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
      >
        <button type="button" className="action-btn" onClick={onCancel}>
          <VscChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {script.name}
        </h2>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
          Enter the required parameters
        </p>

        {script.inputs.map((input, index) => (
          <div key={input.name} className="flex flex-col gap-1">
            <label
              htmlFor={input.name}
              className="text-[11px] font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {input.label}
            </label>
            <input
              ref={index === 0 ? firstInputRef : undefined}
              id={input.name}
              type={input.type === 'number' ? 'number' : 'text'}
              className="input"
              value={values[input.name] || ''}
              onChange={(e) =>
                setValues(prev => ({ ...prev, [input.name]: e.target.value }))
              }
              placeholder={`${input.label} (${input.type})`}
            />
          </div>
        ))}

        <div className="flex justify-end pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <button type="submit" className="btn btn-primary">
            <VscPlay size={14} />
            <span>Run</span>
          </button>
        </div>
      </form>
    </div>
  );
}
