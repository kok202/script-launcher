import { useState, useEffect } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { Script, ScriptInput, ScriptLanguage } from "../types";
import { VscAdd, VscTrash, VscChevronLeft } from "react-icons/vsc";

// Monaco Editor를 CDN에서 로드하도록 설정 (Electron 호환성)
loader.config({
  paths: {
    vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs",
  },
});

interface ScriptEditorProps {
  script: Script | null;
  onSave: (script: Script) => void;
  onCancel: () => void;
}

const SAMPLE_CODE: Record<ScriptLanguage, string> = {
  javascript: `// Input variables: a, b (from parameters above)
const sum = a + b;
console.log(\`\${a} + \${b} = \${sum}\`);`,
  python: `# Input variables: a, b (from parameters above)
sum = a + b
print(f"{a} + {b} = {sum}")`,
  shell: `#!/bin/bash
# Input variables: a, b (from parameters above, passed as env vars)
sum=$((a + b))
echo "$a + $b = $sum"`,
};

export function ScriptEditor({ script, onSave, onCancel }: ScriptEditorProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<ScriptLanguage>("shell");
  const [inputs, setInputs] = useState<ScriptInput[]>([]);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (script) {
      setName(script.name);
      setCode(script.code);
      setLanguage(script.language || "shell");
      setInputs(script.inputs);
    } else {
      setName("");
      setCode(SAMPLE_CODE.shell);
      setLanguage("shell");
      setInputs([]);
    }
  }, [script]);

  const handleLanguageChange = (lang: ScriptLanguage) => {
    setLanguage(lang);
    if (!script) {
      setCode(SAMPLE_CODE[lang]);
    }
  };

  const addInput = () => {
    setInputs((prev) => [
      ...prev,
      {
        name: `input${prev.length + 1}`,
        type: "string",
        label: `Input ${prev.length + 1}`,
      },
    ]);
  };

  const updateInput = (index: number, updates: Partial<ScriptInput>) => {
    setInputs((prev) =>
      prev.map((input, i) => (i === index ? { ...input, ...updates } : input))
    );
  };

  const removeInput = (index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    onSave({
      id: script?.id || "",
      name: name.trim(),
      code: code.trim(),
      language,
      inputs,
      createdAt: script?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  };

  const getMonacoLanguage = () => {
    if (language === "python") return "python";
    if (language === "shell") return "shell";
    return "javascript";
  };

  const handleEditorMount = () => {
    setEditorReady(true);
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
        <button type="button" className="action-btn" onClick={onCancel}>
          <VscChevronLeft size={16} />
        </button>
        <h2
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {script ? "Edit Script" : "New Script"}
        </h2>
      </div>

      {/* Form */}
      <form
        id="script-form"
        onSubmit={handleSubmit}
        className="flex-1 flex flex-col overflow-y-auto p-2 gap-2 min-h-0"
      >
        {/* Name & Language Row */}
        <div className="flex gap-2 flex-shrink-0">
          <div className="flex-1 flex flex-col gap-0.5">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Name
            </label>
            <input
              type="text"
              className="input input-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Script name"
              required
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Language
            </label>
            <select
              className="input input-sm w-24"
              value={language}
              onChange={(e) =>
                handleLanguageChange(e.target.value as ScriptLanguage)
              }
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="shell">Shell</option>
            </select>
          </div>
        </div>

        {/* Parameters - Moved above code */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <div className="flex items-center justify-between">
            <label
              className="text-[10px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Parameters
            </label>
            <button type="button" className="btn btn-small" onClick={addInput}>
              <VscAdd size={10} />
              <span>Add</span>
            </button>
          </div>

          {inputs.length === 0 ? (
            <p className="text-[10px]" style={{ color: "var(--text-hint)" }}>
              No parameters
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {inputs.map((input, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    className="input input-sm flex-1"
                    value={input.name}
                    onChange={(e) =>
                      updateInput(index, { name: e.target.value })
                    }
                    placeholder="Variable"
                  />
                  <input
                    type="text"
                    className="input input-sm flex-1"
                    value={input.label}
                    onChange={(e) =>
                      updateInput(index, { label: e.target.value })
                    }
                    placeholder="Label"
                  />
                  <select
                    className="input input-sm w-20"
                    value={input.type}
                    onChange={(e) =>
                      updateInput(index, {
                        type: e.target.value as "string" | "number",
                      })
                    }
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                  </select>
                  <button
                    type="button"
                    className="action-btn danger"
                    onClick={() => removeInput(index)}
                  >
                    <VscTrash size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Editor */}
        <div className="flex-1 flex flex-col gap-0.5 min-h-[120px]">
          <label
            className="text-[10px] font-medium"
            style={{ color: "var(--text-secondary)" }}
          >
            Code
          </label>
          <div
            className="flex-1 rounded overflow-hidden border relative"
            style={{ borderColor: "var(--border)", minHeight: "120px" }}
          >
            {!editorReady && (
              <div
                className="absolute inset-0 flex items-center justify-center z-10"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--text-hint)" }}
                >
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Loading editor...</span>
                </div>
              </div>
            )}
            <Editor
              height="100%"
              language={getMonacoLanguage()}
              value={code}
              onChange={(value) => setCode(value || "")}
              theme="vs-dark"
              onMount={handleEditorMount}
              loading=""
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                fontFamily: "SF Mono, Fira Code, Monaco, monospace",
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: "on",
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
        </div>
      </form>

      {/* Actions - Fixed at bottom */}
      <div
        className="flex justify-end gap-2 px-3 py-2 border-t flex-shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" form="script-form" className="btn btn-primary">
          Save
        </button>
      </div>
    </div>
  );
}
