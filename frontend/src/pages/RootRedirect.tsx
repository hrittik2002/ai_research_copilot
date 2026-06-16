import { Navigate } from 'react-router-dom';
import { MOCK_SESSIONS } from '../mock-data';

export function RootRedirect() {
  const sessions = MOCK_SESSIONS;
  if (sessions.length === 0) return <Navigate to="/sessions/new" replace />;
  return <Navigate to={`/sessions/${sessions[0].session_id}`} replace />;
}
