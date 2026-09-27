import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Compass className="mx-auto h-14 w-14 text-brand-600" aria-hidden />
      <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-700">404</p>
      <h1 className="mt-1 text-2xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-slate-600">The link may be broken, or the page may have moved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link to="/" className="btn-secondary">
          Home
        </Link>
        <Link to="/board" className="btn-primary">
          Open the board
        </Link>
      </div>
    </div>
  );
}
