import { useCallback } from 'react';
import { chatBibliometric, friendlyAiError } from '../../api/aiApi';
import { buildBibliometricChatContext } from '../../utils/aiChatContext';
import type { ChatMessage } from '../../shared/types';

interface AIChatAssistantProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

export default function AIChatAssistant({
  messages,
  setMessages,
  input,
  setInput,
  loading,
  setLoading,
}: AIChatAssistantProps) {
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((p) => [...p, { r: 'user', t: text }]);
    setInput('');
    setLoading(true);
    try {
      const history = messages.slice(-8).map((m) => ({
        role: (m.r === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.t,
      }));
      const res = await chatBibliometric({
        message: text,
        history,
        context: buildBibliometricChatContext(),
      });
      setMessages((p) => [
        ...p,
        { r: 'ai', t: res.ok ? `${res.text}\n\n— ${res.disclaimer}` : 'Sin respuesta' },
      ]);
    } catch (err) {
      setMessages((p) => [...p, { r: 'ai', t: friendlyAiError(err) }]);
    }
    setLoading(false);
  }, [input, loading, messages, setInput, setLoading, setMessages]);

  return (
    <div className="ai-chat">
      <div className="ai-chat__hint">
        Asistente bibliométrico (Claude vía servidor). No expone la API key. Contexto: resumen institucional, no el dataset completo.
      </div>
      <div className="chat-window">
        {messages.length === 0 && (
          <div className="ai-chat__empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            Pregunta sobre investigadores, ODS, colaboraciones o producción UTA.
            <div className="ai-chat__suggestions">
              {[
                '¿Qué investigadores trabajan en cambio climático?',
                '¿Quién tiene mayor impacto en ODS 3?',
                'Resume la producción científica institucional',
                'Oportunidades de colaboración internacional',
              ].map((q) => (
                <button key={q} type="button" className="btn btn--ghost btn--sm" onClick={() => setInput(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-message chat-message--${m.r === 'user' ? 'user' : 'ai'}`}>
            <div className={`chat-bubble chat-bubble--${m.r === 'user' ? 'user' : 'ai'}`}>
              {m.r === 'ai' && <span className="ai-chat__label">Claude · UTA</span>}
              {m.t}
            </div>
          </div>
        ))}
        {loading && <div className="ai-chat__loading">Analizando datos…</div>}
      </div>
      <div className="chat-input">
        <input
          className="chat-input__field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          placeholder="Pregunta bibliométrica…"
          disabled={loading}
        />
        <button type="button" onClick={() => void send()} disabled={loading} className="btn btn--gradient">
          Enviar
        </button>
      </div>
    </div>
  );
}
