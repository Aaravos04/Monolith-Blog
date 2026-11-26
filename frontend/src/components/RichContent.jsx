import DOMPurify from 'dompurify';
import { useMemo } from 'react';

// Renders a blog body (HTML from the Tiptap editor). It is sanitized first, because posts are
// written by other users. Your Django API should sanitize on save as well (e.g. with nh3).
const RichContent = ({ html, className = '' }) => {
  const clean = useMemo(() => DOMPurify.sanitize(html || '', { ADD_ATTR: ['target'] }), [html]);

  return (
    <div
      className={`prose max-w-none font-serif ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
};

export default RichContent;
