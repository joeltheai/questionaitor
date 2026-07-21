import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'

export const Route = createFileRoute('/')({ component: Home })

export type Question = {
  q: string
  choices: Array<string | number>
  ans: string | number
}

function normalizeChoices(value: unknown): Array<string | number> | null {
  if (Array.isArray(value)) {
    return value as Array<string | number>
  }
  return null
}

function parseQuestions(raw: string): Question[] {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Input is empty.')
  }

  // Allow a looser paste format: unquoted keys, single quotes, and
  // choices written as {a, b, c} instead of [a, b, c].
  const normalized = trimmed
    .replace(/'/g, '"')
    .replace(/(\w+)\s*:/g, '"$1":')
    .replace(/"choices"\s*:\s*\{([^}]*)\}/g, (_, inner: string) => {
      return `"choices": [${inner}]`
    })

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    throw new Error('Could not parse JSON. Check the format and try again.')
  }

  const list = Array.isArray(parsed) ? parsed : [parsed]
  const questions: Question[] = []

  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || typeof item !== 'object') {
      throw new Error(`Item ${i + 1} is not an object.`)
    }

    const record = item as Record<string, unknown>
    const q = record.q
    const ans = record.ans
    const choices = normalizeChoices(record.choices)

    if (typeof q !== 'string' || !q.trim()) {
      throw new Error(`Item ${i + 1} is missing a valid "q" string.`)
    }
    if (choices === null || choices.length === 0) {
      throw new Error(`Item ${i + 1} needs a non-empty "choices" array.`)
    }
    if (ans === undefined || ans === null || ans === '') {
      throw new Error(`Item ${i + 1} is missing "ans".`)
    }

    questions.push({ q, choices, ans: ans as string | number })
  }

  return questions
}

function Home() {
  const [paste, setPaste] = useState('')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function loadFromText(text: string) {
    try {
      const parsed = parseQuestions(text)
      setQuestions(parsed)
      setError(null)
      setPaste(text)
    } catch (err) {
      setQuestions(null)
      setError(err instanceof Error ? err.message : 'Failed to load questions.')
    }
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      loadFromText(text)
    }
    reader.onerror = () => {
      setError('Could not read the file.')
      setQuestions(null)
    }
    reader.readAsText(file)
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-3xl font-bold">Questionaitor</h1>
      <p className="mt-2 text-base">
        Upload a list of questions as JSON (paste, click, or drag and drop).
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Paste JSON</h2>
        <textarea
          className="mt-3 block w-full border border-black p-3 font-mono text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={12}
          placeholder={`[
  {
    "q": "Your question?",
    "choices": [4.25, 5, 3.67, 2],
    "ans": 4.25
  }
]`}
        />
        <button
          type="button"
          className="mt-3 border border-black px-3 py-1.5 text-sm"
          onClick={() => loadFromText(paste)}
        >
          Load from paste
        </button>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Upload file</h2>
        <div
          className={`mt-3 border border-black p-6 ${dragging ? 'border-2' : ''}`}
          onDragEnter={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragging(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
        >
          <p className="text-sm">
            {dragging
              ? 'Drop the file here…'
              : 'Drag and drop a .json file here, or use the button below.'}
          </p>
          <button
            type="button"
            className="mt-3 border border-black px-3 py-1.5 text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      {error ? (
        <p className="mt-6 text-sm font-medium">Error: {error}</p>
      ) : null}

      {questions ? (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">
            Loaded {questions.length} question
            {questions.length === 1 ? '' : 's'}
          </h2>
          <ol className="mt-4 list-decimal space-y-4 pl-5">
            {questions.map((question, index) => (
              <li key={index} className="text-base">
                <div className="font-medium">{question.q}</div>
                <div className="mt-1 text-sm">
                  Choices: {question.choices.join(', ')}
                </div>
                <div className="text-sm">Answer: {String(question.ans)}</div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
