import { useEffect, useState } from 'react';
import { initials } from '../lib/format';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
};

// A person's profile picture, or their initials when they have not set one (or it fails to load).
// It is decorative: the person's name is always shown next to it.
const Avatar = ({ user, size = 'md', className = '' }) => {
  const [broken, setBroken] = useState(false);

  // A new picture gets a fresh chance to load.
  useEffect(() => {
    console.log(user);
    setBroken(false);
  }, [user?.avatar]);

  const base = `${SIZES[size]} shrink-0 rounded-full border border-ink ${className}`;

  if (user?.avatar && !broken) {
    return (
      <img
        src={user.avatar}
        alt=""
        onError={() => setBroken(true)}
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} inline-flex items-center justify-center bg-paper font-bold`}
    >
      {initials(user)}
    </span>
  );
};

export default Avatar;
