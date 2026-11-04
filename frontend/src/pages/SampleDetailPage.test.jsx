import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SampleDetailPage from './SampleDetailPage'

const { getSampleMock, getAnswerMock, openAuthModalMock } = vi.hoisted(() => ({
  getSampleMock: vi.fn(),
  getAnswerMock: vi.fn(),
  openAuthModalMock: vi.fn(),
}))

vi.mock('../services/sampleService', () => ({ getSample: getSampleMock }))
vi.mock('../services/examService', () => ({ getSpeakingSampleAnswer: getAnswerMock }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 7 }, openAuthModal: openAuthModalMock }) }))

describe('SampleDetailPage', () => {
  it('shows Speaking rich content and structured Part questions with generated answer and vocabulary', async () => {
    getSampleMock.mockResolvedValueOnce({
      id: 5,
      title: 'A memorable place',
      level: 'task2',
      examType: 'Describe a place',
      content: '<p>Use a clear beginning and ending.</p>',
      parts: [{
        id: 9,
        partNumber: 2,
        title: 'Describe a place you enjoyed visiting',
        description: 'You should say where it is and why you liked it.',
        questions: [{ id: 11, questionText: 'Where did you go?' }],
      }],
    })
    getAnswerMock.mockResolvedValueOnce({
      sampleAnswer: 'I visited a peaceful coastal town last summer.',
      keyVocabulary: [{ phrase: 'coastal town', meaning: 'thị trấn ven biển' }],
    })

    render(
      <MemoryRouter initialEntries={['/samples/speaking/5']}>
        <Routes><Route path="/samples/speaking/:id" element={<SampleDetailPage skill="speaking" />} /></Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Use a clear beginning and ending.')).toBeInTheDocument()
    expect(screen.getByText('Describe a place you enjoyed visiting')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý trả lời & từ vựng' }))
    expect(await screen.findByText('I visited a peaceful coastal town last summer.')).toBeInTheDocument()
    expect(screen.getByText('coastal town')).toBeInTheDocument()
    await waitFor(() => expect(getAnswerMock).toHaveBeenCalledWith({ questionText: 'Where did you go?', partNumber: 2 }))
  })
})
