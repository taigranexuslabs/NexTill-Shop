import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, CircleHelp, Settings2, ChartNoAxesCombined, WalletCards, Users, UserRoundCog } from "lucide-react-native";
import { useStore } from "../../src/StoreProvider";
import { AppScreen, ScreenHeader, Surface } from "../../src/components/Screen";
import { colors } from "../../src/theme";

const links = [
  { title: "Shop settings & backup", detail: "Shop details and a safe copy of your records", icon: Settings2, href: "/settings" },
  { title: "Reports", detail: "See sales and estimated profit", icon: ChartNoAxesCombined, href: "/reports" },
  { title: "Expenses", detail: "Keep a list of shop spending", icon: WalletCards, href: "/expenses" },
  { title: "Customers", detail: "See customer visit history", icon: Users, href: "/customers" },
  { title: "Money customers owe", detail: "See balances and record payments", icon: WalletCards, href: "/due-payments" },
  { title: "Staff list", detail: "Keep your team contact list", icon: UserRoundCog, href: "/staff" },
];

export default function MoreScreen() {
  const { shop } = useStore();
  const ownerInitial = String(shop?.owner_name || shop?.name || "N").trim().charAt(0).toUpperCase();

  return (
    <AppScreen>
      <ScreenHeader title="Tools" subtitle="Everything else for running your shop" />
      <Surface style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{ownerInitial}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.owner}>{shop?.owner_name || "Shop owner"}</Text>
          <Text style={styles.shopName}>{shop?.name || "Your shop"}</Text>
          {shop?.address ? <Text style={styles.address} numberOfLines={1}>{shop.address}</Text> : null}
        </View>
      </Surface>
      <Text style={styles.section}>YOUR SHOP</Text>
      <Surface style={styles.menu}>
        {links.map(({ title, detail, icon: Icon, href }, index) => (
          <Pressable key={title} style={[styles.menuItem, index < links.length - 1 && styles.menuDivider]} onPress={() => router.push(href)}>
            <View style={styles.menuIcon}><Icon size={18} color={colors.red} strokeWidth={2} /></View>
            <View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuDetail}>{detail}</Text></View>
            <ChevronRight size={17} color="#9ba1aa" />
          </Pressable>
        ))}
      </Surface>
      <Surface style={styles.about}>
        <View style={styles.aboutIcon}><CircleHelp size={17} color={colors.red} strokeWidth={2} /></View>
        <View style={styles.aboutCopy}>
          <Text style={styles.menuTitle}>NexTill Shop</Text>
          <Text style={styles.menuDetail}>Local-first shop management · Version 1.0.0</Text>
        </View>
      </Surface>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  profile: { minHeight: 91, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  avatar: { width: 50, height: 50, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 25 },
  avatarText: { color: colors.red, fontSize: 20, fontWeight: "800" },
  profileCopy: { flex: 1 },
  owner: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  shopName: { marginTop: 4, color: colors.muted, fontSize: 13 },
  address: { marginTop: 3, color: "#78837f", fontSize: 11 },
  section: { marginTop: 22, marginBottom: 10, color: "#78837f", fontSize: 11, fontWeight: "800", letterSpacing: 0.9 },
  menu: { paddingVertical: 0 },
  menuItem: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12 },
  menuDivider: { borderBottomColor: colors.line, borderBottomWidth: 1 },
  menuIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 12 },
  menuCopy: { flex: 1 },
  menuTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  menuDetail: { marginTop: 4, color: colors.muted, fontSize: 12, lineHeight: 17 },
  about: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  aboutIcon: { width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#fff0ef", borderRadius: 9 },
  aboutCopy: { flex: 1 },
});
