import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CloudOff, RefreshCw, UploadCloud } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { flushOutbox, useOnlineStatus, useOutbox } from '../lib/offlineQueue';

/** Shows offline state + queued requests, and syncs the outbox when back online. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const outbox = useOutbox();
  const { user } = useAuth();
  const qc = useQueryClient();
  const mine = user ? outbox.filter((o) => o.userId === user.id) : [];

  const sync = useCallback(async () => {
    if (!user) return;
    const { sent, dropped } = await flushOutbox(user.id);
    if (sent) {
      toast.success(`${sent} request${sent > 1 ? 's' : ''} saved offline ${sent > 1 ? 'were' : 'was'} posted.`);
      qc.invalidateQueries({ queryKey: ['requests'] });
    }
    dropped.forEach((d) => toast.error(`Could not post queued request. ${d}`, { duration: 8000 }));
  }, [user, qc]);

  useEffect(() => {
    if (online && user && mine.length) void sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, user?.id]);

  if (online && mine.length === 0) return null;

  return (
    <div
      className={`border-b px-4 py-2 text-sm ${online ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`}
      role="status"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        {online ? <UploadCloud className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}
        <span className="font-semibold">{online ? 'Back online.' : "You're offline."}</span>
        <span>
          {online
            ? `${mine.length} request${mine.length > 1 ? 's' : ''} waiting to be posted.`
            : 'Showing the last saved board. New requests you post will be queued and sent automatically when you reconnect.'}
          {!online && mine.length > 0 && ` (${mine.length} queued)`}
        </span>
        {online && mine.length > 0 && (
          <button className="ml-auto inline-flex items-center gap-1 font-semibold underline" onClick={sync}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Sync now
          </button>
        )}
      </div>
    </div>
  );
}
