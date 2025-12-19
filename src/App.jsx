import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const EMOTION_COLORS = {
  Calm: '#5fd4a8',
  Stressed: '#ef798a',
  Excited: '#f6c344',
  Neutral: '#8aa0ff',
}

const normalizeScores = (scores) => {
  const total = scores.reduce((sum, score) => sum + score.score, 0) || 1
  return scores.map((score) => ({
    ...score,
    confidence: Math.round((score.score / total) * 100),
  }))
}

const mockPredictEmotion = async (fileLike) => {
  await new Promise((resolve) => setTimeout(resolve, 900))

  const seed = (fileLike?.name || 'mic').length
  const base = [
    { label: 'Calm', score: 0.32 + (seed % 3) * 0.05 },
    { label: 'Stressed', score: 0.28 + ((seed + 1) % 3) * 0.04 },
    { label: 'Excited', score: 0.25 + ((seed + 2) % 3) * 0.03 },
    { label: 'Neutral', score: 0.15 },
  ]

  // small random jitter to keep the demo feeling alive
  const jittered = base.map((item) => ({
    ...item,
    score: Math.max(0.05, item.score + (Math.random() - 0.5) * 0.12),
  }))

  return normalizeScores(jittered).sort((a, b) => b.confidence - a.confidence)
}

const cues = {
  Calm: 'Voice is steady and soft — likely comfortable.',
  Stressed: 'Faster pace or tension — consider slowing down together.',
  Excited: 'Higher energy — celebrate or channel into a quick activity.',
  Neutral: 'No strong signal — keep checking in.',
}

const suggestions = {
  Calm: ['Offer positive feedback', 'Maintain routine', 'Share a quiet activity'],
  Stressed: ['Give space and deep breaths together', 'Reduce noise/visual clutter', 'Offer a choice between two calming options'],
  Excited: ['Celebrate the moment', 'Pair with a movement break', 'Transition with a short countdown'],
  Neutral: ['Ask “How are you feeling?”', 'Invite a thumbs-up/sideways/down check-in', 'Keep observing for shifts'],
}

const badgeCopy = [
  'Assistive, not diagnostic',
  'Works offline for demos',
  'Parent-friendly language',
  '3-second turnaround',
]

function App() {
  const [audioUrl, setAudioUrl] = useState('')
  const [audioName, setAudioName] = useState('')
  const [results, setResults] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const topEmotion = useMemo(
    () => (results.length ? results[0] : null),
    [results],
  )

  useEffect(() => () => URL.revokeObjectURL(audioUrl), [audioUrl])

  const analyzeAudio = async (file) => {
    setStatus('loading')
    setError('')
    try {
      const prediction = await mockPredictEmotion(file)
      setResults(prediction)
      setStatus('done')
    } catch (err) {
      setError('Could not analyze. Please try again.')
      setStatus('idle')
      console.error(err)
    }
  }

  const handleFile = (file) => {
    if (!file?.type?.startsWith('audio')) {
      setError('Please upload an audio file (wav, m4a, mp3).')
      return
    }
    const url = URL.createObjectURL(file)
    setAudioUrl(url)
    setAudioName(file.name)
    analyzeAudio(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'microphone.webm', { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        setAudioName('Live recording')
        analyzeAudio(file)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setStatus('idle')
      setResults([])
    } catch (err) {
      setError('Microphone permission is needed to record.')
      console.error(err)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop())
    setIsRecording(false)
  }

  const formatConfidence = (value) => `${Math.max(0, Math.min(100, value))}%`

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">A gentle helper for understanding tone · Not diagnostic</p>
          <h1>
            Emotion cues from a short voice clip, explained for caregivers.
          </h1>
          <p className="lede">
            Upload or record a few seconds of speech. The tool offers a simple
            read on the feeling in the voice (calm, stressed, excited) and a few
            ideas you can try. It&apos;s here to support your instincts as a
            caregiver, not replace them.
          </p>
          <div className="badges">
            {badgeCopy.map((item) => (
              <span key={item} className="badge">
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-card">
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              id="file"
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <label htmlFor="file">
              <strong>Upload</strong> a short clip or <strong>drag & drop</strong>
            </label>
            <p className="hint">Ideal: 5–10 seconds, clear speech.</p>
            <div className="actions">
              <button
                className={`pill ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? 'Stop recording' : 'Record 5s snippet'}
              </button>
              <span className="microcopy">
                Uses your mic locally. No cloud upload for this demo.
              </span>
            </div>
          </div>
          {audioUrl && (
            <div className="player">
              <div className="player-meta">
                <p className="label">Now analyzing</p>
                <p className="filename">{audioName}</p>
              </div>
              <audio controls src={audioUrl} />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          {status === 'loading' && (
            <div className="loading">
              <div className="spinner" />
              <p>Running the emotion model…</p>
            </div>
          )}
        </div>
      </header>

      {results.length > 0 && (
        <section className="panel">
          <div className="result-header">
            <div>
              <p className="label">Top signal</p>
              <h2 style={{ color: EMOTION_COLORS[topEmotion.label] }}>
                {topEmotion.label}
              </h2>
              <p className="lede small">
                Confidence {formatConfidence(topEmotion.confidence)} —{' '}
                {cues[topEmotion.label]}
              </p>
            </div>
            <div className="bubble">
              <div
                className="bubble-core"
                style={{
                  background: EMOTION_COLORS[topEmotion.label],
                  boxShadow: `0 10px 40px ${EMOTION_COLORS[topEmotion.label]}40`,
                }}
              />
              <p>Instant read</p>
            </div>
          </div>
          <div className="bars">
            {results.map((item) => (
              <div key={item.label} className="bar">
                <div className="bar-top">
                  <span>{item.label}</span>
                  <span className="value">{formatConfidence(item.confidence)}</span>
                </div>
                <div className="track">
                  <div
                    className="fill"
                    style={{
                      width: `${Math.min(item.confidence, 100)}%`,
                      background: EMOTION_COLORS[item.label],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="grid">
            <div className="card subtle">
              <p className="label">How you might respond</p>
              <p className="lede small">
                These are gentle ideas, not rules. You know your child best —
                use what fits and skip what doesn&apos;t.
              </p>
              <ul>
                {suggestions[topEmotion.label].map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
            <div className="card subtle">
              <p className="label">What this page is doing</p>
              <p className="lede small">
                The tool listens to a short piece of speech and gives a simple
                guess about the overall feeling in the voice. It&apos;s here to
                give you an extra clue, not to label or diagnose your child.
              </p>
              <p className="microcopy">
                You stay in control: you decide what this information means for
                your family and what to do next.
              </p>
            </div>
            <div className="card subtle">
              <p className="label">Ways to talk about it</p>
              <p className="lede small">
                You might say things like, &quot;It sounds like your voice is a
                bit {topEmotion.label.toLowerCase()} right now — does that feel
                right to you?&quot; or &quot;The app thinks you&apos;re
                excited. What do you think?&quot;
              </p>
              <div className="chips">
                <span>Curious, not judgmental</span>
                <span>Child leads the story</span>
                <span>Supportive tone</span>
              </div>
            </div>
          </div>
        </section>
      )}

    </div>
  )
}

export default App
