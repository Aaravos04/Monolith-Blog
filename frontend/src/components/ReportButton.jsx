import { Flag } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ReportDialog from './ReportDialog';

// A "Report" button that opens the report form. Only logged-in people see it, because a report
// needs to know who sent it. Place it only where the person is not the owner of the thing.
//   type: 'blog' | 'comment' | 'user'     id: the id of that blog, comment or user
//   variant: 'button' (outlined, for a page header) or 'link' (small text, for a list row)
const ReportButton = ({ type, id, subject, variant = 'link' }) => {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!isAuthenticated) return null;

  const isButton = variant === 'button';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isButton ? 'btn btn-outline btn-sm' : 'inline-flex items-center gap-1 text-xs hover:underline'
        }
      >
        <Flag size={isButton ? 14 : 12} aria-hidden="true" />
        Report
      </button>
      <ReportDialog open={open} onClose={close} type={type} id={id} subject={subject} />
    </>
  );
};

export default ReportButton;
