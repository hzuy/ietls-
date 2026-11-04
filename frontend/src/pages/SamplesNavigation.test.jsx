import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SamplesPage from './SamplesPage'
import SampleDetailPage from './SampleDetailPage'

const { getSampleMock } = vi.hoisted(() => ({ getSampleMock: vi.fn() }))

vi.mock('../services/sampleService', () => ({ getSample: getSampleMock }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null, openAuthModal: vi.fn() }) }))

describe('Writing and Speaking sample navigation', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ id: 17, title: 'Sample detail is reachable', level: 'task2', examType: 'Opinion essay', tags: [] }],
        pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
        examTypes: ['Opinion essay'],
      }),
    })
  })

  it.each(['writing', 'speaking'])('opens the %s detail page from its sample card', async skill => {
    getSampleMock.mockResolvedValueOnce(skill === 'writing'
      ? { id: 17, title: 'Sample detail is reachable', level: 'task2', examType: 'Opinion essay', content: '<p>Writing sample body</p>' }
      : {
          id: 17, title: 'Sample detail is reachable', level: 'task2', examType: 'Part 2', content: null,
          parts: [{ id: 2, partNumber: 2, title: 'Describe a place', description: null, questions: [{ id: 4, questionText: 'Where is it?' }] }],
        })

    render(
      <MemoryRouter initialEntries={[`/${skill}-samples`]}>
        <Routes>
          <Route path="/writing-samples" element={<SamplesPage skill="writing" />} />
          <Route path="/speaking-samples" element={<SamplesPage skill="speaking" />} />
          <Route path="/samples/writing/:id" element={<SampleDetailPage skill="writing" />} />
          <Route path="/samples/speaking/:id" element={<SampleDetailPage skill="speaking" />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findAllByText('Sample detail is reachable')
    const href = `/samples/${skill}/17`
    const cardLink = await waitFor(() => {
      const link = screen.getAllByRole('link').find(item => item.getAttribute('href') === href)
      if (!link) throw new Error('Sample card link was not rendered')
      return link
    })
    fireEvent.click(cardLink)

    if (skill === 'writing') expect(await screen.findByText('Writing sample body')).toBeInTheDocument()
    else expect(await screen.findByText('Where is it?')).toBeInTheDocument()
    expect(getSampleMock).toHaveBeenCalledWith(skill, '17')
  })
})
