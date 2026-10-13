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
  getFullTestStatus: vi.fn(() => Promise.resolve({ isComplete: false })),
  retrySpeakingGrading: vi.fn(),
  getSpeakingSampleAnswer: vi.fn().mockResolvedValue({
    sampleAnswer: 'Definitely, I love spending time outdoors in nature to recharge my batteries.',
    keyVocabulary: [
      { phrase: 'recharge my batteries', meaning: 'nạp lại năng lượng' },
      { phrase: 'in nature', meaning: 'hòa mình vào thiên nhiên' },
    ],
  }),
}))

vi.mock('../services/draftService', () => ({
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  clearDraft: vi.fn(),
  isDataEmpty: vi.fn(),
  formatSavedAt: vi.fn(() => '12:00'),
}))

const mockUser = { id: 1, name: 'Test User' }
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}))

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}))

const mockUseBrowserHistoryGuard = vi.fn((enabled) => ({
  showModal: false,
  stay: vi.fn(),
  leave: vi.fn(),
}))

vi.mock('../hooks/useBrowserHistoryGuard', () => ({
  useBrowserHistoryGuard: (...args) => mockUseBrowserHistoryGuard(...args),
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
    }, { timeout: 3000 })

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

    // Candidate is in user_speaking state
    await waitFor(() => {
      expect(screen.getByText('Đang thu âm câu trả lời...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Nộp Part 2/i })).toBeInTheDocument()
    })

    // Click "Nộp Part 2" only 1 time!
    fireEvent.click(screen.getByRole('button', { name: /Nộp Part 2/i }))

    // mockStopRecording is called
    expect(mockStopRecording).toHaveBeenCalled()

    // Screen transitions immediately to Part 3 preparation interface!
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Part 3/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bắt đầu Part 3' })).toBeInTheDocument()
      expect(screen.queryByText(/Đã hoàn thành Part 2!/i)).not.toBeInTheDocument()
    })

    // simulate recording & whisper finishing
    mockRecordingState.isRecording = false
    mockRecordingState.isTranscribing = false
    rerender(
      <MemoryRouter initialEntries={['/speaking/40']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    // auto-submit triggers submitSpeakingExam in the background
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
    }, { timeout: 3000 })
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

    // Stop recording should be triggered automatically and screen switches immediately to Part 3
    await waitFor(() => {
      expect(mockStopRecording).toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: /Part 3/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bắt đầu Part 3' })).toBeInTheDocument()
      expect(screen.queryByText(/Đã hoàn thành Part 2!/i)).not.toBeInTheDocument()
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

  it('renders result view: omits CorrectionSummary text and displays unanswered questions with score 0', async () => {
    examService.getSpeakingExam.mockResolvedValue({
      id: 40,
      title: 'Cambridge 19 Test 1 Speaking',
      speakingParts: [
        {
          id: 201,
          number: 1,
          topic: 'Hometown',
          questions: [
            { id: 1, questionText: 'Where are you from?' },
            { id: 2, questionText: 'What do you like about it?' },
          ],
        },
      ],
    })
    examService.getSpeakingMyResults.mockResolvedValue([
      {
        partId: 201,
        status: 'graded',
        overall: 6.0,
        criteria: {
          fluency: { score: 6.0 },
          vocabulary: { score: 6.0 },
          grammar: { score: 6.0 },
          pronunciation: { score: 6.0 },
        },
        corrections: [{ start: 0, end: 5, original: 'hello', corrected: 'hi', answer: 0 }],
        transcript: JSON.stringify([
          { questionId: 1, text: 'I am from Hanoi capital.', audioUrl: '/uploads/audio.webm' },
        ]),
      },
    ])

    render(
      <MemoryRouter initialEntries={['/speaking/40?viewResult=true']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Where are you from?')).toBeInTheDocument()
    })

    // Question 1 (answered) is rendered with its transcript
    expect(screen.getByText('I am from Hanoi capital.')).toBeInTheDocument()

    // Question 2 (unanswered) is also rendered with score 0!
    expect(screen.getByText('What do you like about it?')).toBeInTheDocument()
    expect(screen.getByText('Chưa có bản ghi âm bài nói.')).toBeInTheDocument()
    expect(screen.getByText('Trôi chảy: 0')).toBeInTheDocument()
    expect(screen.getByText('Từ vựng: 0')).toBeInTheDocument()
    expect(screen.getByText('Ngữ pháp: 0')).toBeInTheDocument()
    // "Đã sửa ... lỗi. Bấm vào từng chỗ sửa để xem giải thích." does NOT exist anywhere
    expect(screen.queryByText(/Bấm vào từng chỗ sửa để xem giải thích/i)).not.toBeInTheDocument()

    // Verify toggle buttons exist and AI blocks are collapsed by default
    const toggleButtons = screen.getAllByRole('button', { name: /Cải thiện câu này/i })
    expect(toggleButtons.length).toBe(2)
    expect(screen.queryByText(/Gợi ý nâng band · Band 7.5 - 8.0/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gợi ý câu trả lời · Band 7.5 - 8.0/i)).not.toBeInTheDocument()

    // Click to drop down / expand both questions
    fireEvent.click(toggleButtons[0])
    fireEvent.click(toggleButtons[1])

    // Both answered and unanswered questions have AI sample / upgrade blocks after expanding
    await waitFor(() => {
      expect(screen.getByText(/Gợi ý nâng band · Band 7.5 - 8.0/i)).toBeInTheDocument()
      expect(screen.getByText(/Gợi ý câu trả lời · Band 7.5 - 8.0/i)).toBeInTheDocument()
      expect(screen.getAllByText(/Definitely, I love spending time outdoors/i).length).toBe(2)
      expect(screen.getAllByText('recharge my batteries').length).toBe(2)
      expect(screen.getAllByText('nạp lại năng lượng').length).toBe(2)
      expect(screen.queryByText(/Từ vựng ghi điểm:/i)).not.toBeInTheDocument()
      expect(screen.getAllByRole('button', { name: /Nghe phát âm mẫu/i }).length).toBe(2)
    })

    // Click toggleButton[0] again to collapse it
    fireEvent.click(toggleButtons[0])
    expect(screen.queryByText(/Gợi ý nâng band · Band 7.5 - 8.0/i)).not.toBeInTheDocument()

    // Header has Close button and useBrowserHistoryGuard is not active
    expect(screen.getByRole('button', { name: /Đóng/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quay lại/i })).not.toBeInTheDocument()
    expect(mockUseBrowserHistoryGuard).toHaveBeenCalledWith(false, expect.any(Function), expect.any(String))
  })

  it('displays correct part title on result page: instructions if entered, otherwise Speaking Part 1/2/3 instead of Cue Card content', async () => {
    examService.getSpeakingExam.mockResolvedValue({
      id: 40,
      title: 'Cambridge 19 Test 1 Speaking',
      speakingParts: [
        {
          id: 201,
          number: 1,
          cueCard: null, // No description entered
          questions: [{ id: 1, questionText: 'Where are you from?' }],
        },
        {
          id: 202,
          number: 2,
          // Admin only pasted the Cue Card, did NOT enter instructions (no \n===\n)
          cueCard: 'Describe a law that was introduced in your country...\nYou should say:\nWhat the law was',
          questions: [],
        },
        {
          id: 203,
          number: 3,
          cueCard: 'Discussion topics about laws and rules', // Has description
          questions: [{ id: 3, questionText: 'Why do we need laws?' }],
        },
      ],
    })
    examService.getSpeakingMyResults.mockResolvedValue([
      { partId: 201, status: 'graded', overall: 6.0, criteria: {} },
      { partId: 202, status: 'graded', overall: 6.5, criteria: {} },
      { partId: 203, status: 'graded', overall: 7.0, criteria: {} },
    ])

    render(
      <MemoryRouter initialEntries={['/speaking/40?viewResult=true']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      // Part 1: No description -> "Speaking Part 1"
      expect(screen.getByText('Speaking Part 1')).toBeInTheDocument()
      // Part 2: No instructions entered (only cue card) -> "Speaking Part 2"
      expect(screen.getByText('Speaking Part 2')).toBeInTheDocument()
      // Part 2 Cue card text must NOT be shown as part title!
      expect(screen.queryByTitle(/Describe a law that was introduced in your country/i)).not.toBeInTheDocument()
      // Part 3: Has description -> shows description
      expect(screen.getByText('Discussion topics about laws and rules')).toBeInTheDocument()
    })
  })

  it('displays Part 2 instructions as title when instructions are provided before \\n===\\n', async () => {
    examService.getSpeakingExam.mockResolvedValue({
      id: 41,
      title: 'Cambridge 19 Test 2 Speaking',
      speakingParts: [
        {
          id: 302,
          number: 2,
          cueCard: 'Describe a memorable journey that you made.\n===\nYou should say:\nWhere you went\nWho you went with',
          questions: [],
        },
      ],
    })
    examService.getSpeakingMyResults.mockResolvedValue([
      { partId: 302, status: 'graded', overall: 6.5, criteria: {} },
    ])

    render(
      <MemoryRouter initialEntries={['/speaking/41?viewResult=true']}>
        <Routes>
          <Route path="/speaking/:id" element={<SpeakingExam />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Describe a memorable journey that you made.')).toBeInTheDocument()
      expect(screen.queryByTitle(/You should say:/i)).not.toBeInTheDocument()
    })
  })
})

