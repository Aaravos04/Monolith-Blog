import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Notice from '../components/Notice';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Field names match Django's default user model.
const Register = () => {
  useDocumentTitle('Sign up');
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">It takes less than a minute.</p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className="label">
              First name
            </label>
            <input
              id="first_name"
              className="input"
              autoComplete="given-name"
              value={form.first_name}
              onChange={update('first_name')}
              required
            />
          </div>
          <div>
            <label htmlFor="last_name" className="label">
              Last name
            </label>
            <input
              id="last_name"
              className="input"
              autoComplete="family-name"
              value={form.last_name}
              onChange={update('last_name')}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            value={form.username}
            onChange={update('username')}
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="input"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
          />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>

        {error && <Notice>{error}</Notice>}

        <button className="btn btn-primary w-full" disabled={submitting}>
          <UserPlus size={16} aria-hidden="true" />
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm">
        Already have an account?{' '}
        <Link to="/login" className="font-medium underline">
          Log in
        </Link>
      </p>
    </div>
  );
};

export default Register;
