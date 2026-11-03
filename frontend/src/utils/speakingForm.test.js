import { describe, expect, it } from 'vitest'
import { addSpeakingQuestion, loadSpeakingQuestions, removeSpeakingQuestion, restoreSpeakingDraft, serializeSpeakingQuestions } from './speakingForm'

const header = { id: 10, questionText: '##TOPIC##:Technology', audioUrl: '/topic.mp3', ttsScript: 'Technology' }
const first = { id: 11, questionText: 'First question?', audioUrl: '/first.mp3', ttsScript: 'Custom first narration' }
const second = { id: 12, questionText: 'Second question?', audioUrl: '/second.mp3', ttsScript: 'Custom second narration' }

describe('Speaking editor metadata', () => {
  it('round-trips topic marker rows and custom audio through string inputs and JSON drafts', () => {
    const part = loadSpeakingQuestions([header, first, second], true)
    expect(part.questions).toEqual(['First question?', 'Second question?'])
    expect(serializeSpeakingQuestions(JSON.parse(JSON.stringify(part)))).toEqual([header, first, second])
  })

  it('removes the matching metadata without assigning the removed audio to its successor', () => {
    const part = removeSpeakingQuestion(loadSpeakingQuestions([header, first, second], true), 0)
    expect(serializeSpeakingQuestions(part)).toEqual([header, second])
  })

  it('clears stale audio and script only for a changed question', () => {
    const part = loadSpeakingQuestions([first, second])
    part.questions[0] = 'A different question?'
    expect(serializeSpeakingQuestions(part)).toEqual([
      { id: first.id, questionText: 'A different question?', audioUrl: null, ttsScript: null }, second,
    ])
  })

  it('keeps a trailing topic header ahead of a newly added question', () => {
    const part = addSpeakingQuestion(loadSpeakingQuestions([first, header], true))
    part.questions[1] = 'Added question?'
    expect(serializeSpeakingQuestions(part)).toEqual([
      first, header, { questionText: 'Added question?', audioUrl: null, ttsScript: null },
    ])
  })

  it('hydrates older string-only drafts by unchanged text instead of assuming matching indices', () => {
    const current = { part3: { introAudioUrl: '/intro.mp3', introTtsScript: 'Intro', ...loadSpeakingQuestions([header, first, second], true) } }
    const restored = restoreSpeakingDraft({ part3: { questions: ['Second question?'] } }, current)
    expect(restored.part3.introAudioUrl).toBe('/intro.mp3')
    expect(serializeSpeakingQuestions(restored.part3)).toEqual([header, second])
  })
})
