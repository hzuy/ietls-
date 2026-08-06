import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecording } from './useSpeechRecording';

describe('useSpeechRecording Hook — Whisper-only mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('luôn trả về useFallback=true bất kể trình duyệt (Whisper-only)', () => {
    const setTranscripts = vi.fn();
    const { result } = renderHook(() => useSpeechRecording({}, setTranscripts));
    expect(result.current.useFallback).toBe(true);
  });

  it('khởi tạo transcribeError là null', () => {
    const setTranscripts = vi.fn();
    const { result } = renderHook(() => useSpeechRecording({}, setTranscripts));
    expect(result.current.transcribeError).toBeNull();
  });

  it('gọi getUserMedia khi startRecording — nếu lỗi mic thì setIsRecording vẫn là false', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      },
      configurable: true,
    });

    const setTranscripts = vi.fn();
    const { result } = renderHook(() => useSpeechRecording({}, setTranscripts));

    await act(async () => {
      await result.current.startRecording('part-1');
    });

    expect(result.current.isRecording).toBe(false);
  });
});
