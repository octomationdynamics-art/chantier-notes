import { useState } from 'react'
import { DEFAULT_TAGS } from '../types'

interface Props {
  value: string[]
  onChange: (tags: string[]) => void
  extraSuggestions?: string[]
}

export function TagChips({ value, onChange, extraSuggestions = [] }: Props) {
  const [custom, setCustom] = useState('')

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag])
  }

  function submitCustom() {
    const t = custom.trim()
    if (!t) return
    if (!value.includes(t)) onChange([...value, t])
    setCustom('')
  }

  const suggestions = Array.from(
    new Set<string>([...DEFAULT_TAGS, ...extraSuggestions, ...value]),
  )

  return (
    <div className="tag-row">
      <div className="tag-chips">
        {suggestions.map((t) => {
          const active = value.includes(t)
          return (
            <button
              key={t}
              type="button"
              className={`tag-chip ${active ? 'active' : ''}`}
              onClick={() => toggle(t)}
            >
              {active ? '✓ ' : ''}{t}
            </button>
          )
        })}
        <input
          type="text"
          className="tag-custom"
          value={custom}
          placeholder="+ tag"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              submitCustom()
            }
          }}
          onBlur={submitCustom}
        />
      </div>
    </div>
  )
}
