import { useId } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  label?: string
  placeholder?: string
}

export function ChantierPicker({
  value,
  onChange,
  suggestions,
  label = 'Chantier',
  placeholder = 'Ex: Rue de la Paix · Villa X',
}: Props) {
  const listId = useId()
  return (
    <div className="picker-row">
      <label className="picker-label" htmlFor={listId}>
        {label}
      </label>
      <input
        id={listId}
        className="picker-input"
        type="text"
        list={`${listId}-list`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      <datalist id={`${listId}-list`}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
