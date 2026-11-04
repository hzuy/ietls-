import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import SamplesPage from './SamplesPage'

const samples = [
  { id: 1, title: 'Education and technology', level: 'task2', examType: 'Opinion essay', tags: [] },
]

describe('SamplesPage', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: samples,
        pagination: { page: 1, pageSize: 12, total: 25, totalPages: 3 },
        examTypes: ['Opinion essay', 'Bar chart'],
      }),
    })
  })

  it('loads one server page with search and left-side filters', async () => {
    render(
      <MemoryRouter initialEntries={['/writing-samples']}>
        <Routes><Route path="/writing-samples" element={<SamplesPage skill="writing" />} /></Routes>
      </MemoryRouter>
    )

    expect((await screen.findAllByText('Education and technology')).length).toBeGreaterThan(0)
    expect(screen.getByRole('searchbox', { name: 'Tìm bài mẫu theo tiêu đề' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Sắp xếp bài mẫu' })).not.toBeInTheDocument()
    expect(screen.queryByText('Mới nhất')).not.toBeInTheDocument()
    expect(screen.queryByText('Tên A–Z')).not.toBeInTheDocument()
    expect(screen.queryByText('Tên Z–A')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/samples/writing/1')).toBe(true)
    expect(screen.getByText('Trang 1 / 3')).toBeInTheDocument()
    const requestedUrl = new URL(globalThis.fetch.mock.calls[0][0])
    expect(requestedUrl.searchParams.get('pageSize')).toBe('12')
    expect(requestedUrl.searchParams.get('page')).toBe('1')
  })

  it('updates the URL and requests the next page', async () => {
    render(
      <MemoryRouter initialEntries={['/speaking-samples']}>
        <Routes><Route path="/speaking-samples" element={<SamplesPage skill="speaking" />} /></Routes>
      </MemoryRouter>
    )

    await screen.findAllByText('Education and technology')
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
    const requestedUrl = new URL(globalThis.fetch.mock.calls[1][0])
    expect(requestedUrl.searchParams.get('page')).toBe('2')
    expect(screen.getByText('Trang 2 / 3')).toBeInTheDocument()
  })

  it('keeps filters in the left column without a filter icon or active-filter chips below search', async () => {
    render(
      <MemoryRouter initialEntries={['/writing-samples?task=task2&type=Opinion%20essay']}>
        <Routes><Route path="/writing-samples" element={<SamplesPage skill="writing" />} /></Routes>
      </MemoryRouter>
    )

    await screen.findAllByText('Education and technology')
    expect(screen.getByText('Dạng bài')).toBeInTheDocument()
    expect(screen.queryByText('Bộ lọc')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Task 2 ×' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Opinion essay ×' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xóa tất cả' })).not.toBeInTheDocument()
  })

  it('debounces title search and sends the query to the API', async () => {
    render(
      <MemoryRouter initialEntries={['/writing-samples?page=3']}>
        <Routes><Route path="/writing-samples" element={<SamplesPage skill="writing" />} /></Routes>
      </MemoryRouter>
    )

    await screen.findAllByText('Education and technology')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Tìm bài mẫu theo tiêu đề' }), { target: { value: 'education' } })
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2))
    const searchUrl = new URL(globalThis.fetch.mock.calls[1][0])
    expect(searchUrl.searchParams.get('search')).toBe('education')
    expect(searchUrl.searchParams.get('page')).toBe('1')

  })
})
