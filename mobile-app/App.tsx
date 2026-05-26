import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import KioskScreen from './src/screens/KioskScreen';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KioskScreen />
      </SafeAreaProvider>
    </View>
  );
}
