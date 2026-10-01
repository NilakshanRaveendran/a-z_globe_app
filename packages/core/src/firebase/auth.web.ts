import {
  RecaptchaVerifier,
  signInWithPhoneNumber as sendPhoneCode,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

export { getAuth, onAuthStateChanged, signOut, updateProfile, type User, type ConfirmationResult } from 'firebase/auth';

export async function signInWithPhoneNumber(auth: Auth, phone: string): Promise<ConfirmationResult> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const verifier = new RecaptchaVerifier(auth, container, { size: 'invisible' });
  try {
    return await sendPhoneCode(auth, phone, verifier);
  } finally {
    verifier.clear();
    container.remove();
  }
}
