import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

/** Last-resort guard so an unexpected render error never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Clear the error when the user navigates elsewhere.
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center" role="alert">
        <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" aria-hidden />
        <h1 className="mt-4 text-xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-slate-600">{this.state.error.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button className="btn-secondary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <a href="/board" className="btn-primary">
            Go to the board
          </a>
        </div>
      </div>
    );
  }
}
