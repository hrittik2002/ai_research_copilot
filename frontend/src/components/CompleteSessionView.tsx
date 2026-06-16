import { useState, useRef, useEffect } from 'react';
import { Send, Download, ChevronDown, ChevronUp } from 'lucide-react';
import type { Session, Message } from '../types';
import { MOCK_MESSAGES } from '../mock-data';

// --- Report Panel ---

function ReportSection({ title, value }: { title: string; value: string | string[] }) {
  return (
    <div className="mb-5">
      <h4 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#9b9b97' }}>
        {title}
      </h4>
      {Array.isArray(value) ? (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm" style={{ color: '#e8e8e6' }}>
              <span style={{ color: '#d97757', flexShrink: 0 }}>•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm leading-relaxed" style={{ color: '#e8e8e6' }}>
          {value}
        </p>
      )}
    </div>
  );
}

interface ReportPanelProps {
  session: Session;
}

function ReportPanel({ session }: ReportPanelProps) {
  const report = session.report;
  if (!report) return null;

  const sections = [
    { title: 'Company Overview', value: report.company_overview },
    { title: 'Products & Services', value: report.products_services },
    { title: 'Target Customers', value: report.target_customers },
    { title: 'Business Signals', value: report.business_signals },
    { title: 'Risks & Challenges', value: report.risks_challenges },
    { title: 'Discovery Questions', value: report.discovery_questions },
    { title: 'Outreach Strategy', value: report.outreach_strategy },
    { title: 'Unknowns', value: report.unknowns },
    { title: 'Sources', value: report.sources },
  ];

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderRight: '1px solid #3a3a3a' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid #3a3a3a' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#e8e8e6' }}>
            {session.company_name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#9b9b97' }}>
            Research Report
          </p>
        </div>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            color: '#e8e8e6',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#d97757')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
        >
          <Download size={12} />
          PDF
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {sections.map(s => (
          <ReportSection key={s.title} title={s.title} value={s.value} />
        ))}
      </div>
    </div>
  );
}

// --- Message Bubble ---

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  // Render basic markdown bold (**text**)
  function renderContent(text: string) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} style={{ color: '#e8e8e6', fontWeight: 600 }}>
          {part}
        </strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div
          className="max-w-xs px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed"
          style={{ backgroundColor: '#d97757', color: '#fff' }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div
        className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
        style={{ backgroundColor: '#2a2a2a', color: '#d97757', border: '1px solid #3a3a3a' }}
      >
        AI
      </div>
      <div
        className="flex-1 px-4 py-2.5 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-line"
        style={{ backgroundColor: '#2a2a2a', color: '#9b9b97' }}
      >
        {renderContent(message.content)}
      </div>
    </div>
  );
}

// --- Chat Panel ---

interface ChatPanelProps {
  session: Session;
}

function ChatPanel({ session: _session }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = {
      message_id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    // Mock streaming: show typing indicator then add fake reply
    setTimeout(() => {
      const assistantMsg: Message = {
        message_id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content:
          "Great question! Based on the research report, I can provide more context on that. The data collected suggests there are several key factors to consider here. Let me elaborate on the most relevant points from the briefing.",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 py-4"
        style={{ borderBottom: '1px solid #3a3a3a' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: '#e8e8e6' }}>
          Chat
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#9b9b97' }}>
          Ask follow-up questions about the report
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: '#9b9b97' }}>
              No messages yet — ask something about the report
            </p>
          </div>
        )}
        {messages.map(m => (
          <MessageBubble key={m.message_id} message={m} />
        ))}
        {isTyping && (
          <div className="flex gap-3 mb-4">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ backgroundColor: '#2a2a2a', color: '#d97757', border: '1px solid #3a3a3a' }}
            >
              AI
            </div>
            <div
              className="px-4 py-3 rounded-2xl rounded-tl-sm flex gap-1.5 items-center"
              style={{ backgroundColor: '#2a2a2a' }}
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ backgroundColor: '#9b9b97', animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0 px-4 py-3 flex gap-2 items-end"
        style={{ borderTop: '1px solid #3a3a3a' }}
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything about the report…"
          rows={1}
          className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none resize-none overflow-hidden"
          style={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            color: '#e8e8e6',
            maxHeight: '120px',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = '#d97757')}
          onBlur={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
          onInput={e => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${t.scrollHeight}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
          style={{
            backgroundColor: input.trim() && !isTyping ? '#d97757' : '#3a3a3a',
            color: input.trim() && !isTyping ? '#fff' : '#9b9b97',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// --- Mobile collapsible report ---

interface MobileReportToggleProps {
  session: Session;
}

function MobileReportToggle({ session }: MobileReportToggleProps) {
  const [open, setOpen] = useState(false);
  const report = session.report;
  if (!report) return null;

  const sections = [
    { title: 'Company Overview', value: report.company_overview },
    { title: 'Products & Services', value: report.products_services },
    { title: 'Target Customers', value: report.target_customers },
    { title: 'Business Signals', value: report.business_signals },
    { title: 'Risks & Challenges', value: report.risks_challenges },
    { title: 'Discovery Questions', value: report.discovery_questions },
    { title: 'Outreach Strategy', value: report.outreach_strategy },
    { title: 'Unknowns', value: report.unknowns },
    { title: 'Sources', value: report.sources },
  ];

  return (
    <div style={{ borderBottom: '1px solid #3a3a3a' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
        style={{ color: '#e8e8e6', backgroundColor: '#2a2a2a' }}
      >
        <span>View Report — {session.company_name}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div
          className="px-4 py-4 overflow-y-auto"
          style={{ maxHeight: '40vh', backgroundColor: '#1a1a1a' }}
        >
          {sections.map(s => (
            <ReportSection key={s.title} title={s.title} value={s.value} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Combined view ---

export function CompleteSessionView({ session }: { session: Session }) {
  return (
    <>
      {/* Desktop: side-by-side */}
      <div className="hidden lg:flex flex-1 min-h-0">
        <div className="w-5/12 flex flex-col min-h-0 overflow-hidden">
          <ReportPanel session={session} />
        </div>
        <div className="w-7/12 flex flex-col min-h-0 overflow-hidden">
          <ChatPanel session={session} />
        </div>
      </div>

      {/* Mobile: stacked */}
      <div className="lg:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
        <MobileReportToggle session={session} />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatPanel session={session} />
        </div>
      </div>
    </>
  );
}
