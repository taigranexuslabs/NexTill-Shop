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
        tabBarInactiveTintColor: "#8b919b",
        tabBarStyle: {
          height: 68,
          paddingTop: 7,
          paddingBottom: 7,
          borderTopColor: colors.line,
          backgroundColor: colors.white,
          elevation: 8,
        },
        tabBarLabelStyle: { fontSize: 9, fontWeight: "600" },
        tabBarIcon: ({ color }) => {
          if (route.name === "sale") {
            return (
              <View style={{ width: 42, height: 42, alignItems: "center", justifyContent: "center", marginTop: -18, backgroundColor: colors.red, borderRadius: 22, borderWidth: 3, borderColor: colors.white, elevation: 4 }}>
                <Plus size={23} color={colors.white} strokeWidth={2.5} />
              </View>
            );
          }
          const Icon = icons[route.name];
          return <Icon size={19} color={color} strokeWidth={2} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="sales" options={{ title: "Sales" }} />
      <Tabs.Screen name="sale" options={{ title: "New Sale" }} />
      <Tabs.Screen name="products" options={{ title: "Products" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
