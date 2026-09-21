import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getAuth, onAuthStateChanged, type User } from '@react-native-firebase/auth';
import { isFirebaseReady, getApp } from '@core/firebase';
import { accountKindOf, type AccountKind } from '@core/account';

export type SessionUser = {
  uid: string;
  firstName: string;
  fullName: string;
  initial: string;
  phone: string;
  email: string;
};

/**
 * 'loading'            auth state not yet known — show nothing
 * 'signed-out'         no user; start the phone flow
 * 'account-unknown'    signed in, but the account lookup FAILED (offline, or a
 *                      denied read). Distinct from 'needs-account-type' on
 *                      purpose: showing the sign-up chooser here would invite a
 *                      returning customer to create a second account they never
 *                      wanted. Offer a retry instead.
 * 'needs-account-type' verified number, and the lookup succeeded finding
 *                      nothing — ask whether they are here to order or to run
 *                      a business
 * 'needs-profile'      account kind chosen, but no display name yet
 * 'ready'              a complete account; show the app for its kind
 */
export type AuthStage =
  | 'loading'
  | 'signed-out'
  | 'account-unknown'
  | 'needs-account-type'
  | 'needs-profile'
  | 'ready';

export type Session = {
  user: SessionUser;
  /**
   * Which kind of account is signed in — the thing that decides whether this
   * app shows the ordering experience or the business one.
   *
   * A-Z Globe is ONE app, but a person and a business are separate accounts
   * with separate Firebase uids (see `@core/account`). Signing in resolves
   * which of the two this uid is, and the root navigator routes on it. Nothing
   * about the separation is weakened by sharing an app: the rules still refuse
   * a customer uid every supplier permission, and vice versa.
   *
   * null while unknown, or when the uid holds no account yet.
   */
  accountKind: AccountKind | null;
  /** Shown in the Home header — "Orr's Hill, Trincomalee" in the design. */
  location: string;
  /** "Good morning" / "Good afternoon" / "Good evening". */
  greeting: string;
  stage: AuthStage;
  /**
   * Re-read the signed-in user and its account kind.
   *
   * `updateProfile()` changes the user but emits no auth-state event, so
   * nothing here would notice the display name being set and the app would sit
   * on the profile step forever. Call this after writing to the profile.
   */
  refreshUser: () => Promise<void>;
};

/**
 * The Figma screens are all drawn signed-in as "Vanan". When no Firebase
 * project is configured the app runs as this user so every screen still matches
 * the design and UI work is never blocked by auth.
 */
const DESIGN_USER: SessionUser = {
  uid: 'dev-vanan',
  firstName: 'Vanan',
  fullName: 'Vanan',
  initial: 'V',
  phone: '071 110 9390',
  email: 'vanan@example.com',
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accountKind, setAccountKind] = useState<AccountKind | null>(null);
  // Whether the last account lookup failed, as opposed to finding nothing.
  const [kindFailed, setKindFailed] = useState(false);
  const [resolved, setResolved] = useState(!isFirebaseReady());
  // `reload()` mutates the User in place, so the object reference never
  // changes and setState alone cannot trigger a re-render. This counter does.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!isFirebaseReady()) return;
    return onAuthStateChanged(getAuth(getApp()), (u) => {
      setFirebaseUser(u);
      if (!u) {
        setAccountKind(null);
        setKindFailed(false);
        setResolved(true);
        return;
      }
      // The account kind decides which half of the app to show, so the session
      // is not reported as settled until it is known. Otherwise the customer
      // tabs would flash before a supplier landed on their dashboard.
      setResolved(false);
      void accountKindOf(u.uid)
        .then((kind) => {
          setAccountKind(kind);
          setKindFailed(false);
        })
        .catch(() => {
          setAccountKind(null);
          setKindFailed(true);
        })
        .finally(() => setResolved(true));
    });
  }, []);

  const refreshUser = useCallback(async () => {
    if (!isFirebaseReady()) return;
    const current = getAuth(getApp()).currentUser;
    if (!current) return;
    await current.reload();
    const next = getAuth(getApp()).currentUser;
    setFirebaseUser(next);
    if (next) {
      try {
        setAccountKind(await accountKindOf(next.uid));
        setKindFailed(false);
      } catch {
        setAccountKind(null);
        setKindFailed(true);
      }
    }
    setRevision((r) => r + 1);
  }, []);

  const value = useMemo<Session>(() => {
    const stage = stageFor(resolved, firebaseUser, accountKind, kindFailed);

    const user: SessionUser = firebaseUser
      ? {
          uid: firebaseUser.uid,
          firstName: (firebaseUser.displayName ?? 'Guest').split(' ')[0] ?? 'Guest',
          fullName: firebaseUser.displayName ?? 'Guest',
          initial: (firebaseUser.displayName ?? 'G').charAt(0).toUpperCase(),
          phone: firebaseUser.phoneNumber ?? '',
          email: firebaseUser.email ?? '',
        }
      : DESIGN_USER;

    return {
      user,
      // Without Firebase the app runs as the design user, who is a customer —
      // so every Figma screen renders exactly as drawn.
      accountKind: isFirebaseReady() ? accountKind : 'customer',
      location: "Orr's Hill, Trincomalee",
      greeting: greetingFor(new Date()),
      stage,
      refreshUser,
    };
  }, [firebaseUser, accountKind, kindFailed, resolved, revision, refreshUser]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

function stageFor(
  resolved: boolean,
  user: User | null,
  kind: AccountKind | null,
  kindFailed: boolean
): AuthStage {
  // No Firebase project: the app runs as the design user, never gated.
  if (!isFirebaseReady()) return 'ready';
  if (!resolved) return 'loading';
  if (!user) return 'signed-out';
  // The lookup failed rather than came back empty. We do not know what this uid
  // is, so we must not guess — offer a retry.
  if (kindFailed) return 'account-unknown';
  // A verified number that holds neither a customer nor a supplier account is a
  // brand-new sign-up. Which one they get is a decision only they can make, and
  // it is not reversible for this uid, so it is asked explicitly.
  if (!kind) return 'needs-account-type';
  // A display name is missing when the profile step was interrupted — resume it
  // rather than dropping the user in as "Guest", which would break the greeting
  // and the avatar initial.
  return user.displayName ? 'ready' : 'needs-profile';
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
