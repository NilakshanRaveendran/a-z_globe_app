export type AuthStackParamList = {
  Phone: undefined;
  Otp: { phone: string };
  /** Only shown for a uid that holds no account yet. */
  ChooseAccountType: undefined;
  CompleteProfile: undefined;
};
