import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MOCK_SESSIONS } from '../mock-data';

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sessions = MOCK_SESSIONS;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
      {/* Desktop sidebar — always visible ≥1024px */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: '260px', borderRight: '1px solid #3a3a3a' }}
      >
        <Sidebar sessions={sessions} />
      </aside>

      {/* Mobile hamburger topbar */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: '#171717', borderBottom: '1px solid #3a3a3a' }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-1.5 rounded-md transition-colors"
          style={{ color: '#e8e8e6' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <Menu size={18} />
        </button>
        <span className="text-sm font-medium" style={{ color: '#e8e8e6' }}>
          AI Research Copilot
        </span>
      </div>

      {/* Mobile sidebar drawer */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 flex flex-col"
            style={{ width: '260px', borderRight: '1px solid #3a3a3a' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid #3a3a3a', backgroundColor: '#171717' }}
            >
              <span className="text-sm font-medium" style={{ color: '#e8e8e6' }}>
                AI Research Copilot
              </span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-md"
                style={{ color: '#9b9b97' }}
              >
                <X size={16} />
              </button>
            </div>
            <Sidebar sessions={sessions} onClose={() => setDrawerOpen(false)} />
          </aside>
        </>
      )}

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pt-0 pt-12">
        <Outlet />
      </main>
    </div>
  );
}
