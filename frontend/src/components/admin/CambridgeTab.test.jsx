import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CambridgeTab from './CambridgeTab'
import api from '../../utils/axios'

vi.mock('../../utils/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

vi.mock('./CambridgeBookComponents', () => ({
  SeriesCard: ({ s, onEdit }) => (
    <div>
      <span>{s.name}</span>
      <button onClick={() => onEdit(s)}>Sửa {s.name}</button>
    </div>
  ),
  SeriesDetailView: () => <div>SeriesDetailView Mock</div>,
}))

describe('CambridgeTab — double-click protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: [] })
  })

  it('disables the "Tạo" button and name input while creating a series, so a double-click sends only one POST request', async () => {
    let resolvePost
    const postPromise = new Promise((resolve) => { resolvePost = resolve })
    api.post.mockReturnValue(postPromise)

    render(<CambridgeTab initialSeriesList={[]} />)

    fireEvent.click(await screen.findByRole('button', { name: '+ Tạo bộ đề đầu tiên' }))
    const input = screen.getByPlaceholderText(/Tên bộ đề/i)
    fireEvent.change(input, { target: { value: 'Cambridge 20' } })

    const createBtn = screen.getByRole('button', { name: 'Tạo' })
    fireEvent.click(createBtn)

    const pendingBtn = await screen.findByRole('button', { name: 'Đang tạo...' })
    expect(pendingBtn).toBeDisabled()
    expect(input).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(api.post).toHaveBeenCalledTimes(1)

    resolvePost({ data: { id: 1, name: 'Cambridge 20' } })
  })

  it('disables the "Lưu" button while renaming a series, so a double-click sends only one PUT request', async () => {
    let resolvePut
    const putPromise = new Promise((resolve) => { resolvePut = resolve })
    api.get.mockResolvedValue({ data: [{ id: 1, name: 'Cambridge 19' }] })
    api.put.mockReturnValue(putPromise)

    render(<CambridgeTab initialSeriesList={[{ id: 1, name: 'Cambridge 19' }]} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa Cambridge 19' }))
    const input = screen.getByDisplayValue('Cambridge 19')
    fireEvent.change(input, { target: { value: 'Cambridge 19 (renamed)' } })

    const saveBtn = screen.getByRole('button', { name: 'Lưu' })
    fireEvent.click(saveBtn)

    const pendingBtn = await screen.findByRole('button', { name: 'Đang lưu...' })
    expect(pendingBtn).toBeDisabled()
    expect(input).toBeDisabled()

    fireEvent.click(pendingBtn)
    expect(api.put).toHaveBeenCalledTimes(1)

    resolvePut({ data: { name: 'Cambridge 19 (renamed)' } })
  })
})
