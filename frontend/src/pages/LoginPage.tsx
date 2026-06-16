import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Incorrect email or password.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: '#1a1a1a' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{ backgroundColor: '#2a2a2a', border: '1px solid #3a3a3a' }}
      >
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3"
            style={{ backgroundColor: '#d97757' }}
          >
            <span className="text-white font-bold text-sm">AI</span>
          </div>
          <h1 className="text-lg font-semibold" style={{ color: '#e8e8e6' }}>
            Sign in to Research Copilot
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9b9b97' }}>
            Welcome back
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: '#e8e8e6' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a', color: '#e8e8e6' }}
              onFocus={e => (e.currentTarget.style.borderColor = '#d97757')}
              onBlur={e => (e.currentTarget.style.borderColor = '#3a3a3a')}
            />
          </div>

          <div>
            <label className="block text-sm mb-1.5 font-medium" style={{ color: '#e8e8e6' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #3a3a3a', color: '#e8e8e6' }}
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
            disabled={loading}
            className="w-full py-2.5 rounded-lg text-sm font-medium transition-opacity cursor-pointer"
            style={{ backgroundColor: '#d97757', color: '#fff', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#9b9b97' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: '#d97757', textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
