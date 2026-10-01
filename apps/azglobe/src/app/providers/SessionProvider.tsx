import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getAuth, onAuthStateChanged, updateProfile as updateAuthProfile, type User } from '@core/firebase/auth';
import { isFirebaseReady, getApp } from '@core/firebase';
import { accountKindOf, readAccountProfile, saveAccountProfile, type AccountKind, type AccountProfile } from '@core/account';
import { createStorage } from '@core/storage';
import { firstGrapheme } from '@core/utils/text';

const demoStorage = createStorage({ id: 'azglobe-demo-session' });

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
  isDemo: boolean;
  switchDemoAccount: (kind: AccountKind) => void;
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
  /**
   * Save the signed-in account's details from the profile page. `fullName` is
   * the person (the Firebase display name); for a business, `businessName`,
   * `email` and `phone` are the business's contact details. A customer's phone
   * is the number they sign in with, so it is only changed in the demo.
   */
  updateProfile: (profile: ProfileEdits) => Promise<void>;
  /** The business's own name (suppliers/{uid}.name) — null for a customer, or until known. */
  businessName: string | null;
  /**
   * The business's contact details (suppliers/{uid}.email / .phone) — distinct
   * from the person's sign-in number. Null for a customer.
   */
  businessContact: { email: string; phone: string } | null;
};

export type ProfileEdits = {
  fullName: string;
  email: string;
  phone: string;
  businessName?: string;
};

/** A demo account's editable details, kept on this device. */
type DemoProfile = Required<Pick<ProfileEdits, 'fullName' | 'email' | 'phone'>> & { businessName?: string };

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

/**
 * Both demo accounts are Vanan's: the personal one, and the business that runs
 * Mama's Kitchen and Yaal Angaadi. The business shows its owner's name, never
 * one of its restaurants'.
 */
const DEMO_PROFILES: Record<AccountKind, DemoProfile> = {
  customer: { fullName: DESIGN_USER.fullName, email: DESIGN_USER.email, phone: DESIGN_USER.phone },
  supplier: {
    fullName: 'Vanan',
    email: 'vanan.business@example.com',
    phone: '071 110 9391',
    businessName: 'Vanan Foods (Pvt) Ltd',
  },
};

function readDemoProfile(kind: AccountKind): DemoProfile {
  try {
    const raw = demoStorage.getString(`profile:${kind}`);
    if (raw) return { ...DEMO_PROFILES[kind], ...(JSON.parse(raw) as Partial<DemoProfile>) };
  } catch {
    // Unreadable — fall back to the design's details.
  }
  return DEMO_PROFILES[kind];
}

function userFrom(uid: string, name: string, phone: string, email: string): SessionUser {
  const fullName = name.trim() || 'Guest';
  return {
    uid,
    firstName: fullName.split(' ')[0] ?? fullName,
    fullName,
    initial: firstGrapheme(fullName).toLocaleUpperCase() || 'G',
    phone,
    email,
  };
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoKind, setDemoKind] = useState<AccountKind>(() =>
    !isFirebaseReady() && demoStorage.getString('kind') === 'supplier' ? 'supplier' : 'customer'
  );
  const switchDemoAccount = useCallback((kind: AccountKind) => {
    if (isFirebaseReady()) return;
    demoStorage.set('kind', kind);
    setDemoKind(kind);
  }, []);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accountKind, setAccountKind] = useState<AccountKind | null>(null);
  // Whether the last account lookup failed, as opposed to finding nothing.
  const [kindFailed, setKindFailed] = useState(false);
  const [resolved, setResolved] = useState(!isFirebaseReady());
  const [demoProfiles, setDemoProfiles] = useState<Record<AccountKind, DemoProfile>>(() => ({
    customer: readDemoProfile('customer'),
    supplier: readDemoProfile('supplier'),
  }));
  // A real business's own name, read from suppliers/{uid} when needed.
  // The account's own profile document (customers/{uid} or suppliers/{uid}):
  // a customer's saved email, a business's name and contact details.
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
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

  // Details kept on the account's own profile document rather than on the
  // sign-in: a customer's email, a business's name, email and phone.
  useEffect(() => {
    if (!firebaseUser || !accountKind) {
      setAccountProfile(null);
      return;
    }
    let live = true;
    readAccountProfile(accountKind, firebaseUser.uid)
      .then((p) => live && setAccountProfile(p))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [firebaseUser, accountKind]);

  const updateProfile = useCallback(
    async (edits: ProfileEdits) => {
      if (!isFirebaseReady()) {
        const next: DemoProfile = {
          fullName: edits.fullName.trim(),
          email: edits.email.trim(),
          phone: edits.phone.trim(),
          ...(demoKind === 'supplier' ? { businessName: edits.businessName?.trim() ?? '' } : {}),
        };
        demoStorage.set(`profile:${demoKind}`, JSON.stringify(next));
        setDemoProfiles((p) => ({ ...p, [demoKind]: next }));
        return;
      }
      const current = getAuth(getApp()).currentUser;
      if (!current || !accountKind) throw new Error('Sign in again to update your profile.');
      await updateAuthProfile(current, { displayName: edits.fullName.trim() });
      if (accountKind === 'supplier') {
        const saved = { name: edits.businessName ?? '', email: edits.email, phone: edits.phone };
        await saveAccountProfile('supplier', current.uid, saved);
        setAccountProfile({ name: saved.name.trim(), email: saved.email.trim(), phone: saved.phone.trim() });
      } else {
        await saveAccountProfile('customer', current.uid, { name: edits.fullName, email: edits.email });
        setAccountProfile((p) => ({ name: edits.fullName.trim(), email: edits.email.trim(), phone: p?.phone ?? '' }));
      }
      await refreshUser();
    },
    [accountKind, demoKind, refreshUser]
  );

  const value = useMemo<Session>(() => {
    const stage = stageFor(resolved, firebaseUser, accountKind, kindFailed);

    const demo = demoProfiles[demoKind];
    const user: SessionUser = firebaseUser
      ? userFrom(
          firebaseUser.uid,
          firebaseUser.displayName ?? '',
          firebaseUser.phoneNumber ?? '',
          // A customer's email is kept on their profile (phone sign-in has none).
          (accountKind === 'customer' ? accountProfile?.email : '') || firebaseUser.email || ''
        )
      : !isFirebaseReady()
        ? userFrom(demoKind === 'supplier' ? 'demo-provider' : DESIGN_USER.uid, demo.fullName, demo.phone, demo.email)
        : DESIGN_USER;

    return {
      user,
      isDemo: !isFirebaseReady(),
      switchDemoAccount,
      accountKind: isFirebaseReady() ? accountKind : demoKind,
      location: "Orr's Hill, Trincomalee",
      greeting: greetingFor(new Date()),
      stage,
      refreshUser,
      updateProfile,
      businessName: !isFirebaseReady()
        ? demoKind === 'supplier'
          ? demo.businessName || null
          : null
        : accountKind === 'supplier'
          ? accountProfile?.name || null
          : null,
      businessContact: !isFirebaseReady()
        ? demoKind === 'supplier'
          ? { email: demo.email, phone: demo.phone }
          : null
        : accountKind === 'supplier'
          ? { email: accountProfile?.email ?? '', phone: accountProfile?.phone ?? '' }
          : null,
    };
  }, [
    firebaseUser,
    accountKind,
    kindFailed,
    resolved,
    revision,
    refreshUser,
    demoKind,
    switchDemoAccount,
    demoProfiles,
    accountProfile,
    updateProfile,
  ]);

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
