import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader } from 'lucide-react';
import { getSessions } from '../api/sessions';

export function RootRedirect() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: getSessions,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader size={18} className="animate-spin" style={{ color: '#d97757' }} />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return <Navigate to="/sessions/new" replace />;
  }

  return <Navigate to={`/sessions/${sessions[0].session_id}`} replace />;
}
