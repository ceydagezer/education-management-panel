import { useEffect, useRef, useState } from 'react'

import { normalizeSearchText } from '../utils/textHelpers'

const getStudentName = (student) =>
  student?.fullName || student?.name || ''

/*
 * Uzun öğrenci açılır listesi yerine ad veya TC ile arama kutusu.
 * Seçim yapılınca kutuda öğrencinin adı görünür; yeniden yazınca
 * seçim temizlenir. Görünüm schedule.css içindeki
 * schedule-student-search-* sınıflarını kullanır.
 */
function StudentSearchSelect({
  id,
  students = [],
  value = '',
  onChange,
  placeholder = 'Ad veya TC yazarak ara',
  getExtraLabel,
  maxResults = 8
}) {
  const [query, setQuery] = useState(null)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  const selectedStudent = students.find(
    (student) => String(student.id) === String(value)
  )

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
      ) {
        setOpen(false)
        setQuery(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const displayValue =
    query ?? getStudentName(selectedStudent)

  const normalizedQuery = normalizeSearchText(query || '')

  const results = normalizedQuery
    ? students
        .filter((student) =>
          normalizeSearchText(
            [getStudentName(student), student.tcNo]
              .filter(Boolean)
              .join(' ')
          ).includes(normalizedQuery)
        )
        .sort((first, second) =>
          getStudentName(first).localeCompare(
            getStudentName(second),
            'tr'
          )
        )
        .slice(0, maxResults)
    : []

  const select = (studentId) => {
    onChange?.(studentId)
    setQuery(null)
    setOpen(false)
  }

  const listId = `${id || 'student-search'}-results`

  return (
    <div
      className="schedule-student-filter-group student-search-select"
      ref={wrapperRef}
    >
      <div className="schedule-student-search-control">
        <span
          className="schedule-student-search-icon"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
        </span>

        <input
          id={id}
          type="text"
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)

            if (value) {
              onChange?.('')
            }
          }}
          onFocus={() => {
            if (query) {
              setOpen(true)
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && open) {
              event.stopPropagation()
              setOpen(false)
              setQuery(null)
            }

            if (event.key === 'Enter' && open && results.length > 0) {
              event.preventDefault()
              select(String(results[0].id))
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
        />

        {displayValue && (
          <button
            type="button"
            className="schedule-student-search-clear"
            onClick={() => select('')}
            aria-label="Seçili öğrenciyi temizle"
          >
            ×
          </button>
        )}
      </div>

      {open && normalizedQuery && (
        <div
          id={listId}
          className="schedule-student-search-results"
          role="listbox"
        >
          {results.length > 0 ? (
            results.map((student) => {
              const extraLabel = getExtraLabel?.(student)

              return (
                <button
                  type="button"
                  className="schedule-student-search-result"
                  key={student.id}
                  role="option"
                  aria-selected={String(student.id) === String(value)}
                  onClick={() => select(String(student.id))}
                >
                  <span className="schedule-student-result-avatar">
                    {getStudentName(student)
                      .charAt(0)
                      .toLocaleUpperCase('tr-TR') || '?'}
                  </span>

                  <span className="schedule-student-result-content">
                    <strong>
                      {getStudentName(student)}
                      {extraLabel ? ` ${extraLabel}` : ''}
                    </strong>
                  </span>
                </button>
              )
            })
          ) : (
            <div className="schedule-student-search-empty">
              Eşleşen öğrenci bulunamadı.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default StudentSearchSelect
