import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

// Shown for unknown URLs, and by the blog and profile pages when the API answers "404".
const NotFound = ({
  title = 'Page not found',
  message = 'The page you are looking for does not exist.',
}) => {
  useDocumentTitle(title);

  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-muted">{message}</p>
      <Link to="/" className="btn btn-primary mt-6">
        Go home
      </Link>
    </div>
  );
};

export default NotFound;
