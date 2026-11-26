import { Flag } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '../api';
import { REPORT_REASONS, REPORT_TARGETS } from '../lib/reports';
import Modal from './Modal';
import Notice from './Notice';

const MAX_DETAILS = 500;

// The report form. type is 'blog', 'comment' or 'user'; id is that thing's id.
// `subject` is a short reminder of what is being reported (a title, a comment, a @username).
const ReportDialog = ({ open, onClose, type, id, subject }) => {
  const detailsId = useId();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Start with a clean form every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setReason('');
    setDetails('');
    setError('');
    setSubmitting(false);
    setSent(false);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Choose a reason.');
      return;
    }
    if (reason === 'other' && !details.trim()) {
      setError('Tell us a little more when you choose "Something else".');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createReport({ type, id, reason, details: details.trim() });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report this ${REPORT_TARGETS[type]}`}>
      {subject && <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{subject}</p>}

      {sent ? (
        <div className="mt-5 space-y-4">
          <Notice kind="success">
            Thank you. Your report has been sent and our team will review it.
          </Notice>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <fieldset>
            <legend className="label">Why are you reporting this?</legend>
            <div className="space-y-2">
              {REPORT_REASONS[type].map(({ value, label }) => (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="report-reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="h-4 w-4 accent-ink"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={detailsId} className="label">
              Details {reason === 'other' ? '(required)' : '(optional)'}
            </label>
            <textarea
              id={detailsId}
              rows={3}
              maxLength={MAX_DETAILS}
              className="input"
              placeholder="Anything that helps us understand the problem"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            <p className="mt-1 text-right text-xs text-muted">
              {details.length}/{MAX_DETAILS}
            </p>
          </div>

          {error && <Notice>{error}</Notice>}

          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={submitting}>
              <Flag size={16} aria-hidden="true" />
              {submitting ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ReportDialog;
