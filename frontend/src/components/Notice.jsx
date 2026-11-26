import { Check, CircleAlert, Info } from 'lucide-react';

const ICONS = { error: CircleAlert, info: Info, success: Check };

// A bordered message box. kind: 'error' | 'info' | 'success'
const Notice = ({ kind = 'error', className = '', children }) => {
  const Icon = ICONS[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`notice ${className}`}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
};

export default Notice;
