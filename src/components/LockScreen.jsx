import { useState, useRef, useEffect } from 'react'

const PIN_LENGTH = 6

export default function LockScreen({ onUnlock }) {
  const [digits, setDigits] = useState([])
  const [shake, setShake] = useState(false)
  const [hint, setHint] = useState('')
  const containerRef = useRef(null)

  // Hidden input trick — keeps native keyboard on mobile
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKey(digit) {
    if (digits.length >= PIN_LENGTH) return
    const next = [...digits, digit]
    setDigits(next)
    if (next.length === PIN_LENGTH) validate(next.join(''))
  }

  function handleDelete() {
    setDigits((d) => d.slice(0, -1))
    setHint('')
  }

  function validate(entered) {
    const correct = import.meta.env.VITE_APP_PIN
    if (!correct) {
      // No PIN set — auto-unlock (dev / unconfigured deploy)
      onUnlock()
      return
    }
    if (entered === correct) {
      sessionStorage.setItem('unlocked', '1')
      onUnlock()
    } else {
      setShake(true)
      setHint('Incorrect passcode')
      setTimeout(() => {
        setShake(false)
        setDigits([])
        setHint('')
      }, 600)
    }
  }

  const dots = Array.from({ length: PIN_LENGTH }, (_, i) => ({
    filled: i < digits.length,
  }))

  return (
    <div className="fixed inset-0 bg-apple-bg flex flex-col items-center justify-center select-none z-50">
      {/* Icon */}
      <div className="w-16 h-16 rounded-apple-lg bg-gradient-to-br from-apple-blue to-blue-700 flex items-center justify-center text-3xl shadow-xl mb-8">
        🏃
      </div>

      <h1 className="text-2xl font-bold text-white mb-1">Fitness</h1>
      <p className="text-apple-secondary text-sm mb-10">Enter your passcode</p>

      {/* Dot indicators */}
      <div
        ref={containerRef}
        className={`flex gap-5 mb-10 ${shake ? 'animate-[shake_.5s_ease]' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease' } : {}}
      >
        {dots.map(({ filled }, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              filled
                ? 'bg-white border-white scale-110'
                : 'bg-transparent border-apple-fill'
            }`}
          />
        ))}
      </div>

      {hint && <p className="text-red-400 text-sm mb-6 -mt-4">{hint}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-72">
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => {
          if (k === '') return <div key={i} />
          const isDelete = k === '⌫'
          return (
            <button
              key={i}
              className={`h-16 rounded-full text-xl font-medium transition-opacity active:opacity-50 ${
                isDelete
                  ? 'text-apple-secondary bg-transparent'
                  : 'bg-apple-elevated text-white'
              }`}
              onClick={() => isDelete ? handleDelete() : handleKey(String(k))}
            >
              {k}
            </button>
          )
        })}
      </div>

      <p className="text-apple-tertiary text-xs mt-10 px-8 text-center">
        Set <code className="text-apple-secondary">VITE_APP_PIN</code> in your Netlify environment variables.
      </p>

      {/* Hidden input for hardware keyboard support */}
      <input
        ref={inputRef}
        type="tel"
        className="opacity-0 absolute w-0 h-0"
        inputMode="numeric"
        maxLength={1}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/,'')
          if (v) handleKey(v)
          e.target.value = ''
        }}
      />

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-10px)}
          40%{transform:translateX(10px)}
          60%{transform:translateX(-8px)}
          80%{transform:translateX(8px)}
        }
      `}</style>
    </div>
  )
}
