import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PhoneScreen } from './screens/PhoneScreen';
import { OtpScreen } from './screens/OtpScreen';
import { ChooseAccountTypeScreen } from './screens/ChooseAccountTypeScreen';
import { CompleteProfileScreen } from './screens/CompleteProfileScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Sign-in stack, shown in place of the app while there is no complete account.
 *
 * It lives in the shell rather than a module because identity is not a Food
 * concern — every A-Z module will sit behind it.
 *
 * A brand-new number passes through ChooseAccountType, which decides whether
 * this uid becomes a customer or a supplier. A returning one skips it: the
 * session resolves the kind from the uid and the root navigator routes on it.
 */
export function AuthNavigator({
  initialRoute = 'Phone',
}: {
  /** 'CompleteProfile' when a verified user was interrupted mid sign-up. */
  initialRoute?: keyof AuthStackParamList;
}) {
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen
        name="ChooseAccountType"
        component={ChooseAccountTypeScreen}
        // The number is verified by now; there is nothing to go back to.
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name="CompleteProfile"
        component={CompleteProfileScreen}
        // The number is already verified; there is nothing to go back to.
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
