import { Image as ImageIcon, Save, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Notice from '../components/Notice';
import RichTextEditor from '../components/RichTextEditor';
import { useAuth } from '../context/AuthContext';
import { isBodyEmpty } from '../lib/format';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const MAX_COVER_BYTES = 5 * 1024 * 1024;

// One page for both writing a new post (/write) and editing one (/write/:id).
const Write = () => {
  useDocumentTitle('Write');
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [savedCover, setSavedCover] = useState(null); // cover already stored on the server
  const [coverFile, setCoverFile] = useState(null); // newly chosen file
  const [coverPreview, setCoverPreview] = useState(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [currentStatus, setCurrentStatus] = useState('draft');

  const [loading, setLoading] = useState(isEdit);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(''); // '' | 'draft' | 'published'
  const [error, setError] = useState('');

  // Load the post when editing.
  useEffect(() => {
    if (!isEdit) return;
    api
      .getBlog(id)
      .then((blog) => {
        if (blog.author.id !== user.id) {
          setLocked(true);
          setError('You can only edit your own posts.');
          return;
        }
        setTitle(blog.title);
        setBody(blog.body);
        setSavedCover(blog.cover_image);
        setCurrentStatus(blog.status);
      })
      .catch((err) => {
        setLocked(true);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, user.id]);

  // Preview for a newly chosen cover file.
  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const shownCover = coverPreview || (removeCover ? null : savedCover);

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('The cover image must be 5 MB or smaller.');
      return;
    }
    setError('');
    setCoverFile(file);
    setRemoveCover(false);
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setRemoveCover(true);
  };

  const submit = async (status) => {
    if (!title.trim()) {
      setError('Add a title first.');
      return;
    }
    if (status === 'published' && isBodyEmpty(body)) {
      setError('Add some content before publishing.');
      return;
    }

    setSaving(status);
    setError('');
    try {
      const payload = { title: title.trim(), body, status, cover: coverFile, removeCover };
      const saved = isEdit ? await api.updateBlog(id, payload) : await api.createBlog(payload);
      navigate(status === 'published' ? `/blogs/${saved.id}` : '/dashboard?tab=drafts');
    } catch (err) {
      setError(err.message);
      setSaving('');
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (locked) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Notice>{error}</Notice>
        <Link to="/dashboard" className="text-sm underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const busy = Boolean(saving);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{isEdit ? 'Edit post' : 'Write a post'}</h1>

      <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-6">
        <div>
          <label htmlFor="title" className="label">
            Title
          </label>
          <input
            id="title"
            className="input text-xl font-bold"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A clear, specific title"
            maxLength={200}
          />
        </div>

        <div>
          <span className="label">Cover image</span>
          {shownCover && (
            <img
              src={shownCover}
              alt="Cover preview"
              className="mb-3 aspect-[2/1] w-full border border-ink object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon size={14} aria-hidden="true" />
              {shownCover ? 'Change image' : 'Add cover image'}
            </button>
            {shownCover && (
              <button type="button" className="btn btn-outline btn-sm" onClick={handleRemoveCover}>
                <X size={14} aria-hidden="true" />
                Remove
              </button>
            )}
            <span className="text-xs text-muted">Optional. Up to 5 MB.</span>
          </div>
        </div>

        <div>
          <span className="label">Body</span>
          <RichTextEditor value={body} onChange={setBody} />
        </div>

        {error && <Notice>{error}</Notice>}

        <div className="flex flex-wrap items-center gap-3 border-t border-ink pt-5">
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => submit('draft')}
          >
            <Save size={16} aria-hidden="true" />
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => submit('published')}
          >
            <Send size={16} aria-hidden="true" />
            {saving === 'published'
              ? 'Publishing…'
              : currentStatus === 'published'
                ? 'Update post'
                : 'Publish'}
          </button>
          {isEdit && currentStatus === 'published' && (
            <span className="text-xs text-muted">
              This post is live. Saving as a draft will unpublish it.
            </span>
          )}
        </div>
      </form>
    </div>
  );
};

export default Write;
