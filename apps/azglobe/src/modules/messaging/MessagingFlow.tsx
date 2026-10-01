import { useNavigation } from "@react-navigation/native";
import { Screen, ScreenHeader, Text } from "@core/ui";
import { View } from "react-native";

/** The connected prototype runs in the PWA; native screens remain separate. */
export function MessagingFlow() {
  const navigation = useNavigation();
  return (
    <Screen>
      <ScreenHeader title="A-Z Groups" onBack={navigation.goBack} />
      <View style={{ padding: 24 }}>
        <Text>Messaging is currently available in the browser preview.</Text>
      </View>
    </Screen>
  );
}
