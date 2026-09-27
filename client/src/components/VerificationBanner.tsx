import { BadgeCheck, Clock3, XCircle } from 'lucide-react';
import type { User } from '../api/types';

/** Explains a volunteer's verification status and what they can do. */
export function VerificationBanner({ user, compact = false }: { user: User; compact?: boolean }) {
  if (user.role !== 'VOLUNTEER') return null;
  const s = user.verificationStatus;
  if (s === 'APPROVED') {
    if (compact) return null;
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900" role="status">
        <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">You're a verified volunteer</p>
          <p className="text-sm">
            You can accept open requests.{user.verificationNote && <> Admin note: “{user.verificationNote}”</>}
          </p>
        </div>
      </div>
    );
  }
  if (s === 'PENDING') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950" role="status">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Your volunteer account is pending verification</p>
          <p className="text-sm">
            You can browse requests, but an admin must verify your ID before you can accept them. This keeps people in
            crisis safe. We'll unlock accepting as soon as you're approved. No need to log out.
          </p>
        </div>
      </div>
    );
  }
  if (s === 'REJECTED') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900" role="status">
        <XCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">Your volunteer verification was not approved</p>
          <p className="text-sm">
            You can view requests but cannot accept them.
            {user.verificationNote && <> Reason: “{user.verificationNote}”</>}
          </p>
        </div>
      </div>
    );
  }
  return null;
}
