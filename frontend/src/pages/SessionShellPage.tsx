import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader } from 'lucide-react';
import { getSession, getWorkflowStatus } from '../api/sessions';
import { WorkflowProgressView } from '../components/WorkflowProgressView';
import { CompleteSessionView } from '../components/CompleteSessionView';
import type { WorkflowStatus } from '../types';

export function SessionShellPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const queryClient = useQueryClient();

  // Fetch the session — includes the report once status === 'complete'
  const {
    data: session,
    isLoading,
    error: sessionError,
  } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId!),
    enabled: !!sessionId,
  });

  const isTerminal = session?.status === 'complete' || session?.status === 'failed';

  // Poll GET /sessions/{id}/status every 5s while the workflow is active
  const { data: workflowStatus } = useQuery({
    queryKey: ['workflow-status', sessionId],
    queryFn: () => getWorkflowStatus(sessionId!),
    enabled: !!sessionId && !!session && !isTerminal,
    refetchInterval: 5000,
  });

  // When the poll detects a terminal state, re-fetch the session so the report
  // (or error) is available and polling stops (isTerminal flips to true)
  useEffect(() => {
    if (workflowStatus?.status === 'complete' || workflowStatus?.status === 'failed') {
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      // Also refresh the sidebar status dot
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    }
  }, [workflowStatus?.status, sessionId, queryClient]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader size={18} className="animate-spin" style={{ color: '#d97757' }} />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: '#9b9b97' }}>
          Session not found.
        </p>
      </div>
    );
  }

  if (session.status === 'complete') {
    return <CompleteSessionView session={session} />;
  }

  // For pending/running/failed — show the workflow progress view.
  // Use polled data when available; fall back to a skeleton with no nodes
  // (visible only for the instant before the first poll returns).
  const liveStatus: WorkflowStatus = workflowStatus ?? {
    session_id: sessionId!,
    status: session.status,
    started_at: session.created_at,
    completed_at: null,
    error_message: null,
    nodes: [],
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Session header */}
      <div
        className="shrink-0 px-5 py-3 flex items-center gap-3"
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
        workflowStatus={liveStatus}
        errorMessage={liveStatus.error_message}
      />

      {/* Disabled input bar — active only once research is complete */}
      <div
        className="shrink-0 px-4 py-3 flex gap-2"
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
