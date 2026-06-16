import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Session } from '../types';

function statusDotClass(status: Session['status']) {
  switch (status) {
    case 'complete':
      return 'bg-success';
    case 'running':
      return 'bg-accent animate-pulse';
    case 'failed':
      return 'bg-error';
    default:
      return 'bg-text-secondary';
  }
}

interface SidebarProps {
  sessions: Session[];
  onClose?: () => void;
}

export function Sidebar({ sessions, onClose }: SidebarProps) {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  function handleNewSession() {
    onClose?.();
    navigate('/sessions/new');
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: '#171717' }}>
      {/* New Session button */}
      <div className="p-3">
        <button
          onClick={handleNewSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          style={{
            color: '#e8e8e6',
            border: '1px solid #3a3a3a',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Plus size={15} />
          New Session
        </button>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #3a3a3a', marginBottom: '8px' }} />

      {/* Session History label */}
      <div className="px-3 pb-1">
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#9b9b97' }}>
          Session History
        </span>
      </div>

      {/* Session list */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {sessions.length === 0 ? (
          <p className="px-3 py-2 text-sm" style={{ color: '#9b9b97' }}>
            No sessions yet — create one
          </p>
        ) : (
          sessions.map(session => {
            const isActive = session.session_id === sessionId;
            return (
              <Link
                key={session.session_id}
                to={`/sessions/${session.session_id}`}
                onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: isActive ? '#2a2a2a' : 'transparent',
                  color: isActive ? '#e8e8e6' : '#9b9b97',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '#222222';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span
                  className={`flex-shrink-0 w-2 h-2 rounded-full ${statusDotClass(session.status)}`}
                />
                <span className="truncate">{session.company_name}</span>
              </Link>
            );
          })
        )}
      </nav>
    </div>
  );
}
