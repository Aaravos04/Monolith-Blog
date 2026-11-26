import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

// Password field with a show/hide toggle.
const PasswordInput = ({ id, value, onChange, autoComplete, minLength }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="input pr-11"
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        minLength={minLength}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-px right-px flex w-10 items-center justify-center hover:bg-ink hover:text-paper"
      >
        {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  );
};

export default PasswordInput;
