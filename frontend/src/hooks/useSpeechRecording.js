import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/axios';

/**
 * useSpeechRecording — Whisper-only speech recording hook.
 *
 * Tất cả trình duyệt (Chrome, Edge, Brave, Firefox, Safari) đều dùng
 * MediaRecorder + Groq Whisper. Web Speech API đã bị loại bỏ hoàn toàn
 * để đảm bảo hành vi đồng nhất 100%: waveform động, timer, audio blob
 * cho nút Play, và không nối chồng transcript khi ghi âm lại.
 */
export function useSpeechRecording(transcripts, setTranscripts) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimText, setInterimText] = useState(''); // kept for API compat, always ''
  const [transcribeError, setTranscribeError] = useState(null);
  const [audioLevels, setAudioLevels] = useState([0.2, 0.4, 0.3, 0.2]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingAudioUrl, setRecordingAudioUrl] = useState(null);

  // Native resource refs
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Control refs
  const isRecordingRef = useRef(false);
  const userStoppedRef = useRef(false);

  // Web Audio API refs
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Stale-closure guard for transcripts
  const transcriptsRef = useRef(transcripts);
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // ── Waveform Analysis ────────────────────────────────────────────────────────

  const stopWaveformAnalysis = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevels([0.2, 0.4, 0.3, 0.2]);
    setRecordingSeconds(0);
  }, []);

  const startWaveformAnalysis = useCallback((stream) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = ctx;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      // Các dải tần tập trung vào vùng giọng nói (80–5000Hz) với overlap
      const BAR_RANGES = [
        { start: 1,  end: 6  },
        { start: 3,  end: 12 },
        { start: 6,  end: 20 },
        { start: 10, end: 30 },
      ];
      const PHASE_OFFSETS = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      let frameCount = 0;

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        frameCount++;
        const levels = BAR_RANGES.map(({ start, end }, i) => {
          let sum = 0;
          for (let j = start; j <= end; j++) sum += dataArray[j];
          const raw = Math.min(1, (sum / (end - start + 1)) / 120);
          const idle = 0.12 + 0.08 * Math.sin(frameCount * 0.08 + PHASE_OFFSETS[i]);
          return Math.max(idle, raw);
        });
        setAudioLevels(levels);
        animFrameRef.current = requestAnimationFrame(tick);
      };
      animFrameRef.current = requestAnimationFrame(tick);

      // Timer
      setRecordingSeconds(0);
      let secs = 0;
      timerIntervalRef.current = setInterval(() => {
        secs += 1;
        setRecordingSeconds(secs);
      }, 1000);
    } catch (e) {
      console.warn('Web Audio API unavailable, waveform disabled:', e.message);
    }
  }, []);

  // ── Object URL management ────────────────────────────────────────────────────

  const revokeAudioUrl = useCallback(() => {
    setRecordingAudioUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  const cleanupRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const forceCleanupAll = useCallback(() => {
    userStoppedRef.current = true;
    isRecordingRef.current = false;
    cleanupRecording();
    stopWaveformAnalysis();
    setIsRecording(false);
    setInterimText('');
  }, [cleanupRecording, stopWaveformAnalysis]);

  useEffect(() => {
    return () => {
      forceCleanupAll();
      revokeAudioUrl();
    };
  }, [forceCleanupAll, revokeAudioUrl]);

  // ── Stop / Cancel ────────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    userStoppedRef.current = true;
    isRecordingRef.current = false;
    stopWaveformAnalysis();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      // onstop handler tiếp tục: isTranscribing=true, gửi Whisper
    }
  }, [stopWaveformAnalysis]);

  const cancelRecording = useCallback(() => {
    userStoppedRef.current = true;
    isRecordingRef.current = false;
    stopWaveformAnalysis();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current._cancelled = true;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, [stopWaveformAnalysis]);

  // ── Core recording function (Whisper-only, tất cả trình duyệt) ──────────────

  const startRecording = useCallback(async (partId) => {
    // Reset state trước khi bắt đầu ghi âm mới
    forceCleanupAll();
    revokeAudioUrl();
    userStoppedRef.current = false;
    setTranscribeError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Khởi động waveform animation ngay khi có stream
      startWaveformAnalysis(stream);

      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
      ].find(t => MediaRecorder.isTypeSupported(t)) || '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr._cancelled = false;
      audioChunksRef.current = [];
      isRecordingRef.current = true;

      mr.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mr.onstop = async () => {
        stopWaveformAnalysis();
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        isRecordingRef.current = false;
        setIsRecording(false);

        if (mr._cancelled) return;

        const chunks = audioChunksRef.current;
        if (!chunks || chunks.length === 0) {
          setTranscribeError('Chưa ghi nhận được giọng nói, vui lòng thử lại.');
          setIsTranscribing(false);
          return;
        }

        const finalMime = mr.mimeType || 'audio/webm';
        const fullAudioBlob = new Blob(chunks, { type: finalMime });

        if (fullAudioBlob.size < 1000) {
          setTranscribeError('Đoạn ghi âm quá ngắn, vui lòng thử lại.');
          setIsTranscribing(false);
          return;
        }

        // Tạo Object URL cho nút Play trước khi upload
        const objectUrl = URL.createObjectURL(fullAudioBlob);
        setRecordingAudioUrl(objectUrl);
        setIsTranscribing(true);
        setTranscribeError(null);

        try {
          const formData = new FormData();
          const ext = finalMime.includes('mp4') ? 'mp4' : 'webm';
          formData.append('audio', fullAudioBlob, `speech_recording.${ext}`);
          formData.append('prompt', transcriptsRef.current[partId] || '');

          const res = await api.post('/speaking/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          const text = (res.data.transcript || '').trim();
          if (text) {
            setTranscribeError(null);
            // Phương án A: THAY THẾ hoàn toàn (không nối chồng)
            setTranscripts(t => ({ ...t, [partId]: text }));
          } else {
            setTranscribeError('AI không nghe thấy rõ nội dung nói, vui lòng thử lại.');
          }
        } catch (e) {
          console.error('Transcription upload error:', e);
          setTranscribeError('Không thể kết nối dịch giọng nói AI. Vui lòng thử lại.');
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = mr;
      mr.start(1000);
      setIsRecording(true);
    } catch (err) {
      stopWaveformAnalysis();
      isRecordingRef.current = false;
      setIsRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Vui lòng cấp quyền truy cập microphone trong trình duyệt.');
      } else {
        alert('Không thể bắt đầu ghi âm. Vui lòng kiểm tra microphone.');
      }
    }
  }, [forceCleanupAll, revokeAudioUrl, startWaveformAnalysis, stopWaveformAnalysis, setTranscripts]);

  return {
    isRecording,
    isTranscribing,
    // useFallback luôn là true — kept for API compat với SpeakingExam.jsx
    useFallback: true,
    interimText,
    transcribeError,
    audioLevels,
    recordingSeconds,
    recordingAudioUrl,
    startRecording,
    stopRecording,
    cancelRecording,
    forceCleanupAll,
  };
}
