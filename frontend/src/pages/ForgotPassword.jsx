import { ArrowLeft, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import Notice from '../components/Notice';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const ForgotPassword = () => {
  useDocumentTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.forgotPassword({ email });
      setMessage(res?.detail || 'If an account exists for that email, a reset link is on its way.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your email and we will send you a link to reset it.
      </p>

      {message ? (
        <Notice kind="success" className="mt-5">
          {message}
        </Notice>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <Notice>{error}</Notice>}

          <button className="btn btn-primary w-full" disabled={submitting}>
            <Mail size={16} aria-hidden="true" />
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm">
        <Link to="/login" className="inline-flex items-center gap-1 underline">
          <ArrowLeft size={14} aria-hidden="true" />
          Back to log in
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
