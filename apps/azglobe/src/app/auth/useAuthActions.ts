import { useCallback, useState } from 'react';
import {
  getAuth,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  updateProfile,
  type ConfirmationResult,
} from '@core/firebase/auth';
import { getApp, isFirebaseReady } from '@core/firebase';
import { ensureAccount, type AccountKind } from '@core/account';
import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@modules/food/store/cart';
import { useActiveOrder } from '@modules/food/store/activeOrder';
import { useSelectedAddressStore } from '@modules/food/store/selectedAddress';

/**
 * Phone / OTP sign-in.
 *
 * Figma has no auth screens, so these are built from the design's own tokens —
 * see `src/app/auth/screens`. The flow itself is Firebase's: request an SMS,
 * confirm the code, then write the user's profile document.
 *
 * Without a Firebase project this is inert and the app runs as the design user
 * (see SessionProvider), so auth never blocks UI work.
 */
/**
 * The pending SMS confirmation, held at module scope rather than in a ref.
 *
 * The phone screen requests the code and the OTP screen confirms it — two
 * different components, so two different `useAuthActions()` instances. A ref
 * would be per-instance, leaving the OTP screen with nothing to confirm
 * against, and every code would look expired.
 */
let pendingConfirmation: ConfirmationResult | null = null;

/** What `signOut` did — `'demo'` means nothing: demo accounts cannot sign out. */
export type SignOutResult = 'signed-out' | 'demo';

export function useAuthActions() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = useCallback(async (phoneE164: string) => {
    if (!isFirebaseReady()) return false;
    setBusy(true);
    setError(null);
    try {
      pendingConfirmation = await signInWithPhoneNumber(getAuth(getApp()), phoneE164);
      return true;
    } catch (e) {
      setError(authMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmCode = useCallback(async (code: string) => {
    if (!pendingConfirmation) {
      setError('Your session expired. Request a new code.');
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await pendingConfirmation.confirm(code);
      // No profile document is written here on purpose. At this point we know
      // the number is verified but not whether this uid already holds an
      // account, nor — if it does not — which kind the person wants. Creating
      // one now would silently make every new sign-up a customer, and the kind
      // is not reversible for a uid.
      //
      // SessionProvider resolves the kind and routes to the account-type step
      // when there is none; `createAccount` below writes it.
      pendingConfirmation = null;
      return true;
    } catch (e) {
      setError(authMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Create the account for a brand-new uid, as the kind the person chose.
   *
   * `ensureAccount` refuses if this uid already holds the other kind, so one
   * Firebase user can never end up being both — the same refusal the security
   * rules make server-side.
   */
  const createAccount = useCallback(async (kind: AccountKind) => {
    const user = getAuth(getApp()).currentUser;
    if (!user) return false;
    setBusy(true);
    setError(null);
    try {
      await ensureAccount(kind, user.uid, { phone: user.phoneNumber });
      return true;
    } catch (e) {
      setError(authMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * `name` is the person (the sign-in's display name). A business also passes
   * `businessName`, which is what its account document — and customers — see.
   */
  const completeProfile = useCallback(async (kind: AccountKind, name: string, email: string, businessName?: string) => {
    const user = getAuth(getApp()).currentUser;
    if (!user) return false;
    setBusy(true);
    setError(null);
    try {
      await updateProfile(user, { displayName: name });
      await ensureAccount(kind, user.uid, {
        name: kind === 'supplier' ? businessName?.trim() || name : name,
        email: email || null,
      });
      return true;
    } catch (e) {
      setError(authMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Sign out and leave nothing of this person behind on the device.
   *
   * The cart, the Home tracker's order pointer and the chosen delivery address
   * are stored on the device, not per account, so without this the next person
   * to sign in on the phone would inherit them — and the query cache would
   * still hold the previous account's orders and address book.
   *
   * Resolves `'demo'` without doing anything when there is no Firebase project:
   * the demo runs as fixed accounts with no sign-in stack to return to, so the
   * caller should explain that rather than appear to do nothing. Rejects if
   * Firebase refuses, leaving everything as it was.
   */
  const signOut = useCallback(async (): Promise<SignOutResult> => {
    if (!isFirebaseReady()) return 'demo';
    pendingConfirmation = null;
    await fbSignOut(getAuth(getApp()));
    useCart.getState().clear();
    useActiveOrder.getState().setOrderId(null);
    useSelectedAddressStore.getState().reset();
    queryClient.clear();
    return 'signed-out';
  }, [queryClient]);

  return { sendCode, confirmCode, createAccount, completeProfile, signOut, busy, error, setError };
}

/** Firebase auth codes are not customer-facing; map the common ones. */
function authMessage(e: unknown): string {
  // `ensureAccount` throws a plain Error when the uid already holds the other
  // kind of account. One app, but a uid is either a person or a business —
  // never both. That is a real situation with a real answer, not a bug, so say
  // what happened instead of "something went wrong".
  if (e instanceof Error && e.message.includes('already holds a')) {
    const holds = e.message.includes('supplier') ? 'business' : 'personal';
    const wanted = holds === 'business' ? 'personal' : 'business';
    return `That number is already an A-Z Globe ${holds} account. A ${wanted} account is separate — sign in with a different number for it.`;
  }
  const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number does not look right.';
    case 'auth/invalid-verification-code':
      return 'That code is not correct. Check and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Request a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'No connection. Check your network and try again.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for today. Try again tomorrow.';
    // Both of these mean the Firebase project is not finished being set up,
    // so say which step is missing rather than a generic failure.
    case 'auth/operation-not-allowed':
      return 'Phone sign-in is not enabled for this Firebase project.';
    case 'auth/app-not-authorized':
    case 'auth/missing-client-identifier':
      return "This build is not authorised — add its SHA-1 to the Firebase Android app.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
