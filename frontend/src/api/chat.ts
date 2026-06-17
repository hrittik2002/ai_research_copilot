import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from '../types';
import { apiClient } from './client';

const WS_BASE = 'ws://localhost:8000';

export async function fetchMessages(sessionId: string): Promise<Message[]> {
  const res = await apiClient.get<Message[]>(`/sessions/${sessionId}/messages`);
  return res.data;
}

interface UseChatResult {
  messages: Message[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => void;
}

export function useChat(sessionId: string, initialMessages: Message[] = []): UseChatResult {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  // Tracks the temp id of the assistant message being streamed so we can append to it
  const streamingIdRef = useRef<string>('');

  useEffect(() => {
    setMessages(initialMessages);
  // Only reset when the session changes, not on every render of initialMessages
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/chat/${sessionId}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onmessage = (event: MessageEvent<string>) => {
      const text = event.data;

      // Try to parse as a control message first
      try {
        const json = JSON.parse(text) as Record<string, unknown>;

        if (json.done) {
          // Replace temp streaming id with the persisted message_id from the server
          const finalId = json.message_id as string;
          setMessages(prev =>
            prev.map(m =>
              m.message_id === streamingIdRef.current ? { ...m, message_id: finalId } : m
            )
          );
          setIsStreaming(false);
          return;
        }

        if (json.error) {
          setError(json.error as string);
          setIsStreaming(false);
          return;
        }
      } catch {
        // Not a control message — it's a streaming token
      }

      // Append token to the in-progress assistant message
      setMessages(prev => {
        const idx = prev.findIndex(m => m.message_id === streamingIdRef.current);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], content: updated[idx].content + text };
          return updated;
        }
        // First token — create the placeholder message
        return [
          ...prev,
          {
            message_id: streamingIdRef.current,
            role: 'assistant' as const,
            content: text,
            created_at: new Date().toISOString(),
          },
        ];
      });
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
      setIsStreaming(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN || isStreaming) return;

      const userMsg: Message = {
        message_id: `user_${Date.now()}`,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };

      // Generate a temp id for the streamed assistant reply
      streamingIdRef.current = `streaming_${Date.now()}`;

      setMessages(prev => [...prev, userMsg]);
      setIsStreaming(true);
      ws.send(JSON.stringify({ message: text }));
    },
    [isStreaming]
  );

  return { messages, isStreaming, error, sendMessage };
}
