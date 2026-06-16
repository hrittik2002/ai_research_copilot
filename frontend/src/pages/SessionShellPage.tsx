import { useParams } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { MOCK_SESSIONS, MOCK_WORKFLOW_STATUS } from '../mock-data';
import { WorkflowProgressView } from '../components/WorkflowProgressView';
import { CompleteSessionView } from '../components/CompleteSessionView';

export function SessionShellPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const session = MOCK_SESSIONS.find(s => s.session_id === sessionId);

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#9b9b97' }}>
          Session not found.
        </p>
      </div>
    );
  }

  if (session.status === 'pending') {
    return (
      <div className="flex-1 flex items-center justify-center gap-3">
        <Loader size={18} className="animate-spin" style={{ color: '#d97757' }} />
        <p className="text-sm" style={{ color: '#9b9b97' }}>
          Starting research…
        </p>
      </div>
    );
  }

  if (session.status === 'complete') {
    return <CompleteSessionView session={session} />;
  }

  // running or failed — show workflow progress view
  // For 'failed' session (sess_003), fabricate a failed workflow status
  const workflowStatus =
    session.session_id === MOCK_WORKFLOW_STATUS.session_id
      ? MOCK_WORKFLOW_STATUS
      : {
          session_id: session.session_id,
          status: session.status,
          started_at: session.created_at,
          completed_at: session.updated_at,
          error_message:
            session.status === 'failed'
              ? 'The website scraper failed to retrieve content. The website may be blocking automated access.'
              : null,
          nodes: [
            { node_name: 'intent_parser', status: 'complete' as const, started_at: session.created_at, output: null, error: null },
            { node_name: 'web_searcher', status: 'complete' as const, started_at: session.created_at, output: null, error: null },
            { node_name: 'website_scraper', status: 'failed' as const, started_at: session.created_at, output: null, error: 'Request timed out' },
            { node_name: 'data_merger', status: 'pending' as const, started_at: null, output: null, error: null },
            { node_name: 'gap_detector', status: 'pending' as const, started_at: null, output: null, error: null },
            { node_name: 'insight_extractor', status: 'pending' as const, started_at: null, output: null, error: null },
            { node_name: 'report_compiler', status: 'pending' as const, started_at: null, output: null, error: null },
            { node_name: 'quality_validator', status: 'pending' as const, started_at: null, output: null, error: null },
            { node_name: 'finalizer', status: 'pending' as const, started_at: null, output: null, error: null },
          ],
        };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Session header */}
      <div
        className="flex-shrink-0 px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid #3a3a3a' }}
      >
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#e8e8e6' }}>
            {session.company_name}
          </h2>
          <p className="text-xs" style={{ color: '#9b9b97' }}>
            {session.company_website}
          </p>
        </div>
        <span
          className="ml-auto text-xs font-mono px-2 py-0.5 rounded"
          style={{
            backgroundColor: session.status === 'failed' ? '#f8717120' : '#d9775720',
            color: session.status === 'failed' ? '#f87171' : '#d97757',
          }}
        >
          {session.status}
        </span>
      </div>

      <WorkflowProgressView
        workflowStatus={workflowStatus}
        errorMessage={workflowStatus.error_message}
      />

      {/* Disabled input bar for running/failed states */}
      <div
        className="flex-shrink-0 px-4 py-3 flex gap-2"
        style={{ borderTop: '1px solid #3a3a3a' }}
      >
        <input
          disabled
          placeholder="Chat will be available once research is complete."
          className="flex-1 px-3 py-2.5 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            color: '#9b9b97',
            cursor: 'not-allowed',
          }}
        />
        <button
          disabled
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#2a2a2a', color: '#9b9b97' }}
        >
          <span style={{ fontSize: '14px' }}>›</span>
        </button>
      </div>
    </div>
  );
}
