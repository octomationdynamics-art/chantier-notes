import { useEffect, useRef, useState } from 'react'
import type { Photo } from '../types'

interface Props {
  photos: Photo[]
  onAdd: (files: File[]) => void
  onDelete?: (photoId: string) => void
  label?: string
}

function ThumbnailImg({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string>('')
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [photo.blob])
  if (!url) return null
  return <img src={url} alt="photo chantier" className="photo-thumb-img" />
}

export function PhotoStrip({ photos, onAdd, onDelete, label = 'Photos' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onAdd(files)
    e.target.value = ''
  }

  return (
    <div className="photo-strip">
      <div className="photo-strip-head">
        <span className="photo-strip-label">{label} ({photos.length})</span>
        <button type="button" className="btn-ghost btn-small" onClick={() => inputRef.current?.click()}>
          📷 Ajouter
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={handleFiles}
        />
      </div>
      {photos.length > 0 && (
        <div className="photo-thumbs">
          {photos.map((p) => (
            <div key={p.id} className={`photo-thumb sync-${p.syncState}`}>
              <ThumbnailImg photo={p} />
              {p.driveUrl && (
                <a className="photo-thumb-link" href={p.driveUrl} target="_blank" rel="noreferrer" title="Ouvrir dans Drive">
                  ↗
                </a>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="photo-thumb-del"
                  title="Supprimer"
                  onClick={() => onDelete(p.id)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
