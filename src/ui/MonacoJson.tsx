import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Bundle Monaco locally — the default CDN loader would break the
// fully-offline/static deployment story.
self.MonacoEnvironment = {
  getWorker: (_id: string, label: string) =>
    label === 'json' ? new jsonWorker() : new editorWorker(),
}
loader.config({ monaco })

export default function MonacoJson({
  value,
  onChange,
  theme,
}: {
  value: string
  onChange: (value: string) => void
  theme: 'dark' | 'light'
}) {
  return (
    <Editor
      height="100%"
      defaultLanguage="json"
      value={value}
      onChange={(v) => onChange(v ?? '')}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      options={{
        minimap: { enabled: false },
        fontSize: 11.5,
        fontFamily: "'IBM Plex Mono', monospace",
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        lineNumbersMinChars: 3,
        padding: { top: 8, bottom: 8 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  )
}
