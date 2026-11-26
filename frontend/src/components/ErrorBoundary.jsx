import { Component } from 'react';

// Catches a crash while a page is drawing and shows a message instead of a blank screen.
// React only supports this through a class, so the methods are written as arrow-function
// properties to match the rest of the code. Give it a `key` (the Layout uses the current
// path) so it resets itself when you navigate away from the broken page.
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError = (error) => ({ error });

  componentDidCatch = (error, info) => {
    // Swap this for a real error reporter (Sentry or similar) in production.
    console.error('Unhandled error in the UI:', error, info?.componentStack);
  };

  render = () => {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-muted">
          This page hit an unexpected problem. Reloading usually fixes it.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a href="/" className="btn btn-outline">
            Go home
          </a>
        </div>
      </div>
    );
  };
}

export default ErrorBoundary;
