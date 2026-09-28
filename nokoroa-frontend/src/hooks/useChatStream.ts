'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { API_CONFIG } from '@/lib/apiConfig';
import { PostData } from '@/types/post';
import { getToken } from '@/utils/auth';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  id: string;
  relatedPosts?: PostData[];
  needsLogin?: boolean;
}

interface UseChatStreamOptions {
  /** パネルが閉じられたら応答中のストリームを止めるために使う */
  isOpen: boolean;
  /** タイピング表示に追従して最下部へスクロールする */
  scrollToBottom: () => void;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isResponding: boolean;
  dynamicSuggestions: string[];
  sendMessage: (messageText?: string) => Promise<void>;
  stopResponding: () => void;
}

const MAX_MESSAGES = 100;
// サーバー側 ChatRequestDto の上限と揃える
const MAX_HISTORY_SENT = 20;
const MAX_HISTORY_CONTENT_LENGTH = 8000;
// 送信メッセージ本文の上限（ChatRequestDto.message と同じ）
export const MAX_INPUT_LENGTH = 2000;

const TYPING_INTERVAL_MS = 20;

const INITIAL_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: 'こんにちは！Sora AIです。旅行の相談があればお気軽にどうぞ！',
  id: 'initial',
};

/** ストリーミング中の吹き出し。初回挨拶は追記対象にしない */
function isStreamingAssistant(message: ChatMessage | undefined): boolean {
  return message?.role === 'assistant' && message.id !== 'initial';
}

function appendToLastAssistant(
  prev: ChatMessage[],
  text: string,
): ChatMessage[] {
  const lastMessage = prev[prev.length - 1];
  if (lastMessage?.role === 'assistant') {
    return [
      ...prev.slice(0, -1),
      { ...lastMessage, content: lastMessage.content + text },
    ];
  }
  return prev;
}

function appendUserMessage(
  prev: ChatMessage[],
  content: string,
  id: string,
): ChatMessage[] {
  const updated = [...prev, { role: 'user' as const, content, id }];
  return updated.length > MAX_MESSAGES ? updated.slice(-MAX_MESSAGES) : updated;
}

function setRelatedPostsOnLastAssistant(
  prev: ChatMessage[],
  posts: PostData[],
): ChatMessage[] {
  const lastMsg = prev[prev.length - 1];
  if (lastMsg?.role === 'assistant') {
    return [...prev.slice(0, -1), { ...lastMsg, relatedPosts: posts }];
  }
  return prev;
}

function readStoredToken(): string | null {
  try {
    return getToken();
  } catch (storageErr) {
    console.warn(
      '[ChatPanel] localStorage access failed, sending without token',
      storageErr,
    );
    return null;
  }
}

function buildErrorContent(
  responseStatus: number,
  isNetworkError: boolean,
): string {
  return isNetworkError
    ? 'ネットワーク接続を確認してください。'
    : responseStatus === 401
      ? 'ログインの有効期限が切れている可能性があります。再ログインしてお試しください。'
      : responseStatus === 429
        ? 'リクエストが集中しています。少し待ってから再度お試しください。'
        : responseStatus >= 500
          ? 'サーバーで問題が発生しました。時間を置いてお試しください。'
          : '申し訳ありません。エラーが発生しました。もう一度お試しください。';
}

async function requestChatStream(
  userMessage: string,
  messages: ChatMessage[],
  token: string | null,
  signal: AbortSignal,
): Promise<Response> {
  // サーバー側の上限(履歴20件 / 1メッセージ8000文字)に合わせて送信分を絞る。
  // 全件送ると会話が伸びるほど入力トークンが増え、上限超過で400になる。
  const history = messages.slice(-MAX_HISTORY_SENT).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    content: msg.content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
  }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_CONFIG.BASE_URL}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: userMessage,
      history,
    }),
    signal,
  });
}

/**
 * SSE のレスポンスを最後まで読み切り、本文と関連投稿を返す。
 * テキストは届いた順に onText へ渡してタイピング表示に供給する。
 */
async function consumeChatStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onText: (data: string) => void,
  onRelatedPosts: (posts: PostData[]) => void,
): Promise<{ fullResponse: string; relatedPosts: PostData[] | null }> {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullResponse = '';
  let relatedPosts: PostData[] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      // SSEは1イベントが複数の data: 行を持ちうる。仕様どおり改行で結合する
      // (1行目だけ見ると、改行を含む生成テキストの2行目以降が欠落する)
      const dataLines = event
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6));

      if (dataLines.length === 0) continue;

      const data = dataLines.join('\n');
      if (data === '[DONE]') {
        continue;
      }
      if (data.startsWith('[ERROR]')) {
        throw new Error(data);
      }

      if (data.startsWith('{')) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'related_posts' && parsed.posts) {
            relatedPosts = parsed.posts as PostData[];
            onRelatedPosts(relatedPosts);
            continue;
          }
        } catch {}
      }

      fullResponse += data;
      onText(data);
    }
  }

  return { fullResponse, relatedPosts };
}

export function useChatStream({
  isOpen,
  scrollToBottom,
}: UseChatStreamOptions): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const charQueueRef = useRef<string[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRespondingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const startTyping = useCallback(() => {
    if (typingTimerRef.current) return;
    typingTimerRef.current = setInterval(() => {
      if (charQueueRef.current.length === 0) {
        if (typingTimerRef.current) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        return;
      }
      const char = charQueueRef.current.shift()!;
      setMessages((prev) => appendToLastAssistant(prev, char));
      scrollToBottom();
    }, TYPING_INTERVAL_MS);
  }, [scrollToBottom]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }, []);

  /** 未表示のキューを打ち切り、残りの文字列をまとめて返す */
  const flushTypingQueue = useCallback(() => {
    const remaining = charQueueRef.current.join('');
    charQueueRef.current = [];
    stopTyping();
    return remaining;
  }, [stopTyping]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!isOpen && isRespondingRef.current) {
      abortControllerRef.current?.abort();
    }
  }, [isOpen]);

  const stopResponding = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const fetchSuggestions = async (
    userMessage: string,
    fullResponse: string,
    token: string | null,
    signal: AbortSignal,
  ) => {
    try {
      const suggestionsHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        suggestionsHeaders['Authorization'] = `Bearer ${token}`;
      }
      const suggestionsRes = await fetch(
        `${API_CONFIG.BASE_URL}/chat/suggestions`,
        {
          method: 'POST',
          headers: suggestionsHeaders,
          body: JSON.stringify({
            message: userMessage,
            ai_response: fullResponse,
          }),
          signal,
        },
      );
      if (suggestionsRes.ok) {
        const suggestionsData = await suggestionsRes.json();
        if (suggestionsData?.suggestions?.length > 0) {
          setDynamicSuggestions(suggestionsData.suggestions);
        }
      } else {
        console.warn(
          '[ChatPanel] suggestions request returned non-ok',
          suggestionsRes.status,
        );
      }
    } catch (suggestionsErr) {
      if ((suggestionsErr as Error)?.name !== 'AbortError') {
        console.warn('[ChatPanel] suggestions fetch failed', suggestionsErr);
      }
    }
  };

  const handleSendError = (err: unknown, responseStatus: number) => {
    const remaining = flushTypingQueue();

    if ((err as Error)?.name === 'AbortError') {
      // 停止ボタン・パネルクローズ時は、そこまで生成済みの文字だけ残す
      if (remaining && mountedRef.current) {
        setMessages((prev) => {
          const lastMessage = prev[prev.length - 1];
          if (isStreamingAssistant(lastMessage)) {
            return appendToLastAssistant(prev, remaining);
          }
          return prev;
        });
      }
      return;
    }

    console.error('[ChatPanel] handleSend failed', err);

    const isNetworkError =
      responseStatus === 0 &&
      (err instanceof TypeError ||
        (typeof navigator !== 'undefined' && navigator.onLine === false));

    const errorContent = buildErrorContent(responseStatus, isNetworkError);

    if (!mountedRef.current) return;

    setMessages((prev) => {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: errorContent,
        id: `error-${Date.now()}`,
        needsLogin: responseStatus === 401,
      };
      const lastMessage = prev[prev.length - 1];
      if (isStreamingAssistant(lastMessage)) {
        const merged = lastMessage.content + remaining;
        if (merged.length === 0) {
          return [...prev.slice(0, -1), errorMessage];
        }
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: merged },
          errorMessage,
        ];
      }
      return [...prev, errorMessage];
    });
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isRespondingRef.current) return;

    isRespondingRef.current = true;
    setIsResponding(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userMessage = textToSend;
    setInput('');
    setDynamicSuggestions([]);
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => appendUserMessage(prev, userMessage, userMsgId));
    setIsLoading(true);

    setTimeout(scrollToBottom, 100);

    let responseStatus = 0;

    const token = readStoredToken();

    try {
      const response = await requestChatStream(
        userMessage,
        messages,
        token,
        controller.signal,
      );

      responseStatus = response.status;

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No reader available');
      }

      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', id: assistantMsgId },
      ]);
      setIsLoading(false);
      charQueueRef.current = [];

      const { fullResponse, relatedPosts } = await consumeChatStream(
        reader,
        (data) => {
          // split('') はサロゲートペアを分断して絵文字が化けるため
          // コードポイント単位で分割する
          charQueueRef.current.push(...Array.from(data));
          startTyping();
        },
        (posts) => {
          setMessages((prev) => setRelatedPostsOnLastAssistant(prev, posts));
        },
      );

      if (charQueueRef.current.length > 0) {
        const remaining = flushTypingQueue();
        setMessages((prev) => appendToLastAssistant(prev, remaining));
      }

      if (relatedPosts) {
        setMessages((prev) =>
          setRelatedPostsOnLastAssistant(prev, relatedPosts),
        );
      }

      if (fullResponse.trim()) {
        await fetchSuggestions(
          userMessage,
          fullResponse,
          token,
          controller.signal,
        );
      }
    } catch (err) {
      handleSendError(err, responseStatus);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (mountedRef.current) {
        setIsLoading(false);
        setIsResponding(false);
      }
      isRespondingRef.current = false;
    }
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    isResponding,
    dynamicSuggestions,
    sendMessage,
    stopResponding,
  };
}
