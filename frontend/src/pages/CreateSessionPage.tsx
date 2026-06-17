import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import axios from 'axios';
import { createSession, runWorkflow } from '../api/sessions';

export function CreateSessionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [researchObjective, setResearchObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = companyName.trim() && companyWebsite.trim() && researchObjective.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      // Step 1: create the session record
      const session = await createSession({
        company_name: companyName.trim(),
        company_website: companyWebsite.trim(),
        research_objective: researchObjective.trim(),
      });

      // Step 2: kick off the workflow
      await runWorkflow(session.session_id);

      // Invalidate the sidebar list so the new session appears immediately
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });

      navigate(`/sessions/${session.session_id}`);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to start research. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: '#1a1a1a',
    border: '1px solid #3a3a3a',
    color: '#e8e8e6',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 overflow-y-auto">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: '#e8e8e6' }}>
            New Research Session
          </h2>
          <p className="text-sm" style={{ color: '#9b9b97' }}>
            Provide company details and we'll generate a full research briefing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#e8e8e6' }}>
              Company Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-3 py-3 rounded-lg text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#d97757')}
              onBlur={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#e8e8e6' }}>
              Company Website
            </label>
            <input
              type="url"
              value={companyWebsite}
              onChange={e => setCompanyWebsite(e.target.value)}
              placeholder="https://acme.com"
              className="w-full px-3 py-3 rounded-lg text-sm outline-none transition-colors"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#d97757')}
              onBlur={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#e8e8e6' }}>
              Research Objective
            </label>
            <textarea
              value={researchObjective}
              onChange={e => setResearchObjective(e.target.value)}
              placeholder="Understand their product offerings before a discovery call"
              rows={3}
              className="w-full px-3 py-3 rounded-lg text-sm outline-none transition-colors resize-none"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#d97757')}
              onBlur={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: '#f87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer"
            style={{
              backgroundColor: canSubmit && !loading ? '#d97757' : '#3a3a3a',
              color: canSubmit && !loading ? '#fff' : '#9b9b97',
              cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (
              <>
                <span
                  className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
                />
                Starting…
              </>
            ) : (
              <>
                Start Research
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
