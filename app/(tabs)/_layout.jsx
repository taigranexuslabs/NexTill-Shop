import { Home, MoreHorizontal, Package, Plus, ReceiptText, Settings2 } from "lucide-react-native";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { colors } from "../../src/theme";

const icons = {
  index: Home,
  sales: ReceiptText,
  products: Package,
  more: MoreHorizontal,
  settings: Settings2,
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: "#78837f",
        tabBarStyle: {
          height: 76,
          paddingTop: 8,
          paddingBottom: 9,
          borderTopColor: colors.line,
          backgroundColor: colors.white,
          elevation: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarIcon: ({ color }) => {
          if (route.name === "sale") {
            return (
              <View style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", marginTop: -20, backgroundColor: colors.red, borderRadius: 24, borderWidth: 3, borderColor: colors.white, elevation: 5 }}>
                <Plus size={25} color={colors.white} strokeWidth={2.5} />
              </View>
            );
          }
          const Icon = icons[route.name];
          return <Icon size={19} color={color} strokeWidth={2} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="sales" options={{ title: "Bills" }} />
      <Tabs.Screen name="sale" options={{ title: "Sell" }} />
      <Tabs.Screen name="products" options={{ title: "Stock" }} />
      <Tabs.Screen name="more" options={{ title: "Tools" }} />
    </Tabs>
  );
}
