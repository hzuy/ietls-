import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SpeakingExam from './SpeakingExam'
import * as examService from '../services/examService'
import * as draftService from '../services/draftService'

// Mock services
vi.mock('../services/examService', () => ({
  getSpeakingExam: vi.fn(),
  getSpeakingMyResults: vi.fn(),
  submitSpeakingExam: vi.fn(),
  getSpeakingStatus: vi.fn(),
  getFullTestStatus: vi.fn(),
  retrySpeakingGrading: vi.fn(),
}))

vi.mock('../services/draftService', () => ({
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  clearDraft: vi.fn(),
  isDataEmpty: vi.fn(),
  formatSavedAt: vi.fn(() => '12:00'),
}))

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Test User' } }),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('../hooks/useBrowserHistoryGuard', () => ({
  useBrowserHistoryGuard: () => ({
    showModal: false,
    stay: vi.fn(),
    leave: vi.fn(),
  }),
}))

const mockForceCleanupAll = vi.fn()
const mockStartRecording = vi.fn()
const mockStopRecording = vi.fn()
const mockCancelRecording = vi.fn()
const mockPauseRecording = vi.fn()
const mockResumeRecording = vi.fn()

let mockRecordingState = {
  isRecording: false,
  isTranscribing: false,
  useFallback: true,
  interimText: '',
  transcribeError: null,
  audioLevels: [0, 0, 0],
  recordingSeconds: 0,
  recordingAudioUrl: null,
}

vi.mock('../hooks/useSpeechRecording', () => ({
  useSpeechRecording: () => ({
    ...mockRecordingState,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    cancelRecording: mockCancelRecording,
    forceCleanupAll: mockForceCleanupAll,
    pauseRecording: mockPauseRecording,
    resumeRecording: mockResumeRecording,
  }),
}))

const mockExamData = {
  id: 40,
  title: 'Cambridge 19 Test 1 Speaking',
  speakingParts: [
    {
      id: 201,
      number: 1,
      topic: 'Hometown',
      questions: [{ id: 1, questionText: 'Where are you from?' }],
    },
    {
      id: 202,
      number: 2,
      topic: 'A memorable law',
      cueCard: 'Describe a law\n===\nYou should say:\nWhat the law was\nWho introduced it',
      questions: [{ id: 2, questionText: 'Describe a law' }],
    },
    {
      id: 203,
      number: 3,
      topic: 'Legal system',
      questions: [{ id: 3, questionText: 'Why do we need laws?' }],
    },
  ],
}

describe('SpeakingExam Part 2 flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    examService.getSpeakingExam.mockResolvedValue(mockExamData)
    // Part 1 is finished in draft -> SpeakingExam advances to Part 2
    draftService.loadDraft.mockReturnValue({
      data: { submittedPartIds: [201] },
      savedAt: new Date().toISOString(),
    })
    draftService.isDataEmpty.mockReturnValue(false)
    examService.getSpeakingMyResults.mockResolvedValue([
      { partId: 201, status: 'graded', criteria: { fluency: { score: 7 } } },
    ])
  })

  it('hides Cue Card on Part 2 intro screen and shows "Bắt đầu Part 2"', async () => {
    render(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    // Wait for exam to load and auto-advance to Part 2
    await waitFor(() => {
      expect(screen.getByText('Cambridge 19 Test 1 Speaking')).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: /Part 2/i })).toBeInTheDocument()
    })

    // Verify Intro screen is shown
    expect(screen.getByText(/Bạn có 1 phút để chuẩn bị và ghi chú cho chủ đề/i)).toBeInTheDocument()
    const startPart2Btn = screen.getByRole('button', { name: 'Bắt đầu Part 2' })
    expect(startPart2Btn).toBeInTheDocument()

    // Verify Cue Card content is NOT visible yet (fairness guard)
    expect(screen.queryByText(/You should say:/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Ghi chú ở đây.../i)).not.toBeInTheDocument()
  })

  it('transitions immediately into preparation (user_preparing) when clicking "Bắt đầu Part 2"', async () => {
    render(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Part 2/i })).toBeInTheDocument()
    })

    // Click "Bắt đầu Part 2"
    const startPart2Btn = screen.getByRole('button', { name: 'Bắt đầu Part 2' })
    fireEvent.click(startPart2Btn)

    // Cue Card and Notes are now revealed!
    await waitFor(() => {
      expect(screen.getByText(/You should say:/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/Ghi chú ở đây.../i)).toBeInTheDocument()
    })

    // Preparation status and skip button are present
    expect(screen.getByText(/Đang có một phút để ghi chú.../i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đã chuẩn bị xong' })).toBeInTheDocument()
  })

  it('does NOT reset Part 3 to intro when background grading for Part 2 completes', async () => {
    // Both Part 1 and Part 2 are in draft / submitted, candidate advances to Part 3
    draftService.loadDraft.mockReturnValue({
      data: { submittedPartIds: [201, 202] },
      savedAt: new Date().toISOString(),
    })
    examService.getSpeakingMyResults.mockResolvedValue([
      { partId: 201, status: 'graded', criteria: { fluency: { score: 7 } } },
      { partId: 202, status: 'graded', criteria: { fluency: { score: 7 } } },
    ])

    render(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    // Verify on Part 3 intro screen
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Part 3/i })).toBeInTheDocument()
    })

    const startPart3Btn = screen.getByRole('button', { name: 'Bắt đầu Part 3' })
    expect(startPart3Btn).toBeInTheDocument()

    // Candidate clicks "Bắt đầu Part 3"
    fireEvent.click(startPart3Btn)

    // Part 3 enters active speaking state
    await waitFor(() => {
      expect(screen.getByText('Đang ghi âm...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ghi nhận câu trả lời' })).toBeInTheDocument()
    })
    // "Bắt đầu Part 3" button should no longer be present
    expect(screen.queryByRole('button', { name: 'Bắt đầu Part 3' })).not.toBeInTheDocument()
  })

  it('submits Part 2 with a single click while speaking and automatically advances to Part 3', async () => {
    examService.submitSpeakingExam.mockResolvedValue({ answerId: 999, status: 'pending' })
    mockRecordingState.isRecording = true

    render(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bắt đầu Part 2' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu Part 2' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Đã chuẩn bị xong' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Đã chuẩn bị xong' }))

    // Candidate is in user_speaking state
    await waitFor(() => {
      expect(screen.getByText('Đang thu âm câu trả lời...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Nộp Part 2/i })).toBeInTheDocument()
    })

    // Click "Nộp Part 2" only 1 time!
    fireEvent.click(screen.getByRole('button', { name: /Nộp Part 2/i }))

    // mockStopRecording is called
    expect(mockStopRecording).toHaveBeenCalled()

    // simulate recording & whisper finishing
    mockRecordingState.isRecording = false
    mockRecordingState.isTranscribing = false

    // auto-submit triggers submitSpeakingExam and advances to Part 3
    await waitFor(() => {
      expect(examService.submitSpeakingExam).toHaveBeenCalledWith('40', 202, expect.anything())
      expect(screen.getByRole('heading', { name: /Part 3/i })).toBeInTheDocument()
    })
  })

  it('automatically submits Part 2 when speaking time hits 120s limit', async () => {
    examService.submitSpeakingExam.mockResolvedValue({ answerId: 999, status: 'pending' })
    mockRecordingState.isRecording = true
    mockRecordingState.recordingSeconds = 0

    const { rerender } = render(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Bắt đầu Part 2' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu Part 2' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Đã chuẩn bị xong' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Đã chuẩn bị xong' }))

    await waitFor(() => {
      expect(screen.getByText('Đang thu âm câu trả lời...')).toBeInTheDocument()
    })

    // Advance recording time to 120s
    mockRecordingState.recordingSeconds = 120
    rerender(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    // Stop recording should be triggered automatically
    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalled()
    })

    // Finish recording & transcription
    mockRecordingState.isRecording = false
    mockRecordingState.isTranscribing = false
    rerender(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    // Auto submit should trigger without any clicks and advance to Part 3!
    await waitFor(() => {
      expect(examService.submitSpeakingExam).toHaveBeenCalledWith('40', 202, expect.anything())
      expect(screen.getByRole('heading', { name: /Part 3/i })).toBeInTheDocument()
    })
  })
})
