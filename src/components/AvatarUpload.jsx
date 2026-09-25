import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// ---------------------------------------------------------------------------
// Validation — hand-written per assignment: know every guard you ship.
//
// Client-side validation = UX (instant feedback, no round trip)
// Storage policy = security (server-side, cannot be bypassed)
// ---------------------------------------------------------------------------
const MAX_BYTES = 1_048_576 // 1 MB exactly

function validateFile(file) {
  // Guard 1: must be an image MIME type
  if (!file.type.startsWith('image/')) {
    return 'Only image files are allowed (JPEG, PNG, WebP, GIF, etc.)'
  }
  // Guard 2: must be ≤ 1 MB
  if (file.size > MAX_BYTES) {
    const sizeMB = (file.size / MAX_BYTES).toFixed(1)
    return `File is too large (${sizeMB} MB). Maximum allowed size is 1 MB.`
  }
  return null // null = valid ✅
}

// ---------------------------------------------------------------------------
// AvatarUpload
//
// Props:
//   userId  — the signed-in user's UUID (used as storage folder name)
// ---------------------------------------------------------------------------
export default function AvatarUpload({ userId }) {
  const [avatarUrl, setAvatarUrl] = useState(null)   // URL stored in profiles table
  const [preview, setPreview]     = useState(null)   // local blob URL before upload
  const [pendingFile, setPending] = useState(null)   // File object waiting to upload
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState('')     // validation error
  const [uploadError, setUploadError] = useState('') // storage/db error
  const inputRef = useRef(null)

  // ── Load existing avatar from profiles on mount ─────────────────────────
  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)         // scoped to signed-in user
        .single()
      if (data?.avatar_url) setAvatarUrl(data.avatar_url)
    }
    loadProfile()
  }, [userId])

  // ── Clean up the blob URL when component unmounts or preview changes ─────
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  // ── File picked from the input ───────────────────────────────────────────
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset previous state
    setFileError('')
    setUploadError('')
    setPending(null)
    if (preview) { URL.revokeObjectURL(preview); setPreview(null) }

    // Hand-written validation (know every guard)
    const error = validateFile(file)
    if (error) {
      setFileError(error)
      e.target.value = ''   // reset the input so the same file can be re-picked
      return
    }

    // Valid file — show instant preview using a local blob URL
    setPending(file)
    setPreview(URL.createObjectURL(file))
  }

  // ── Upload the pending file to Supabase Storage ──────────────────────────
  async function handleUpload() {
    if (!pendingFile) return
    setUploading(true)
    setUploadError('')

    // Storage path: avatars/<userId>/avatar  (no extension — upsert replaces same key)
    // The storage policy checks (storage.foldername(name))[1] = auth.uid()
    // so the folder name MUST be the user's UUID — enforced server-side too.
    const storagePath = `${userId}/avatar`

    const { error: storageError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, pendingFile, {
        upsert: true,          // replace if already exists — no duplicates
        contentType: pendingFile.type,
      })

    if (storageError) {
      setUploadError(storageError.message)
      setUploading(false)
      return
    }

    // Get the permanent public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(storagePath)

    const publicUrl = urlData.publicUrl

    // Persist the URL in the profiles table (upsert in case row doesn't exist yet)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, avatar_url: publicUrl, updated_at: new Date().toISOString() })

    if (profileError) {
      setUploadError(profileError.message)
    } else {
      // Commit — swap preview for the real URL
      setAvatarUrl(publicUrl)
      setPreview(null)
      setPending(null)
      if (inputRef.current) inputRef.current.value = ''
    }

    setUploading(false)
  }

  // ── Cancel the pending pick ──────────────────────────────────────────────
  function handleCancel() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setPending(null)
    setFileError('')
    setUploadError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── What image to show in the circle ────────────────────────────────────
  const displaySrc = preview ?? avatarUrl

  return (
    <div className="avatar-wrap">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="avatar-file-input"
        aria-label="Upload avatar"
        onChange={handleFileChange}
        id="avatar-input"
      />

      {/* Clickable avatar circle */}
      <label htmlFor="avatar-input" className="avatar-circle" title="Change avatar">
        {displaySrc
          ? <img src={displaySrc} alt="Your avatar" className="avatar-img" />
          : <span className="avatar-placeholder" aria-hidden="true">👤</span>
        }
        <span className="avatar-overlay" aria-hidden="true">✎</span>
      </label>

      {/* Inline validation error */}
      {fileError && (
        <p className="avatar-error" role="alert">{fileError}</p>
      )}

      {/* Preview action bar — only shown when a valid file is picked */}
      {pendingFile && !fileError && (
        <div className="avatar-actions">
          <button
            className="primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Save avatar'}
          </button>
          <button
            type="button"
            className="quiet-button"
            onClick={handleCancel}
            disabled={uploading}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Upload / DB error */}
      {uploadError && (
        <p className="avatar-error" role="alert">{uploadError}</p>
      )}
    </div>
  )
}
