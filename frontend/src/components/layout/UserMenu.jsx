import { ChevronDown, LayoutDashboard, LogOut, Pencil, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDismiss } from '../../hooks/useDismiss';
import { displayName } from '../../lib/format';
import Avatar from '../Avatar';

const itemClass =
  'flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-ink hover:text-paper focus-visible:bg-ink focus-visible:text-paper focus-visible:outline-none';

// The logged-in user's picture in the navbar. Click it to open a menu.
// Keyboard: Arrow keys, Home and End move through the items; Escape closes and returns focus.
const UserMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  useDismiss(
    wrapperRef,
    (reason) => {
      setOpen(false);
      if (reason === 'escape') buttonRef.current?.focus();
    },
    open
  );

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) menuRef.current?.querySelector('[role="menuitem"]')?.focus();
  }, [open]);

  const handleMenuKeyDown = (e) => {
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const moveTo = (next) => {
      e.preventDefault();
      items[(next + items.length) % items.length].focus();
    };

    if (e.key === 'ArrowDown') moveTo(index + 1);
    else if (e.key === 'ArrowUp') moveTo(index - 1);
    else if (e.key === 'Home') moveTo(0);
    else if (e.key === 'End') moveTo(items.length - 1);
    else if (e.key === 'Tab') setOpen(false);
  };

  const close = () => setOpen(false);

  const handleLogout = async () => {
    close();
    await logout();
    navigate('/');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-1 border border-transparent p-0.5 hover:border-ink"
      >
        <Avatar user={user} size="sm" />
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 border border-ink bg-paper">
          <div className="flex items-center gap-3 border-b border-ink px-4 py-3">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{displayName(user)}</p>
              <p className="truncate text-xs text-muted">@{user.username}</p>
            </div>
          </div>

          <div ref={menuRef} role="menu" aria-label="Account" onKeyDown={handleMenuKeyDown}>
            <Link to="/dashboard" role="menuitem" className={itemClass} onClick={close}>
              <LayoutDashboard size={16} aria-hidden="true" />
              Dashboard
            </Link>
            <Link to="/write" role="menuitem" className={itemClass} onClick={close}>
              <Pencil size={16} aria-hidden="true" />
              Write
            </Link>
            <Link
              to={`/users/${encodeURIComponent(user.username)}`}
              role="menuitem"
              className={itemClass}
              onClick={close}
            >
              <User size={16} aria-hidden="true" />
              Public profile
            </Link>
            <div className="border-t border-ink">
              <button type="button" role="menuitem" className={itemClass} onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
