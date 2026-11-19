import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import {
  getDatabase,
  getLocalShop,
  getSetting,
  listConflicts,
  archiveProductLocal,
  readProducts,
  readSales,
  recordSaleLocal,
  saveLocalShop,
  saveProductLocal,
  setSetting,
} from "./lib/database";
import { cloudConfigured, supabase } from "./lib/supabase";
import { resolveProductConflict, runScheduledBackupIfDue, runSync } from "./lib/sync";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [cartNotice, setCartNotice] = useState("");
  const [conflicts, setConflicts] = useState([]);
  const [session, setSession] = useState(null);
  const [backupTime, setBackupTime] = useState("06:00");
  const [backupInterval, setBackupInterval] = useState("1");
  const [lastBackupAt, setLastBackupAt] = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const shopId = shop?.id;
  const userId = session?.user?.id;

  const refresh = useCallback(async () => {
    const localShop = await getLocalShop();
    setShop(localShop);
    if (localShop) {
      const [localProducts, localSales, localConflicts] = await Promise.all([
        readProducts(localShop.id),
        readSales(localShop.id),
        listConflicts(localShop.id),
      ]);
      setProducts(localProducts);
      setSales(localSales);
      setConflicts(localConflicts);
    } else {
      setProducts([]);
      setSales([]);
      setConflicts([]);
    }
    setBackupTime(await getSetting("backup_time", "06:00"));
    setBackupInterval(await getSetting("backup_interval_days", "1"));
    setLastBackupAt(await getSetting("last_backup_at"));
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await getDatabase();
      await refresh();
      if (cloudConfigured) {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) setSession(data.session);
        const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (active) setSession(nextSession);
        });
        if (!active) subscription.subscription.unsubscribe();
      }
      if (active) setReady(true);
    }
    initialize().catch((error) => {
      console.error("Could not initialize the local shop database.", error);
      if (active) {
        setSyncMessage(`Database startup failed: ${error.message}`);
        setReady(true);
      }
    });
    return () => { active = false; };
  }, [refresh]);

  const syncNow = useCallback(async () => {
    if (!shopId) throw new Error("Set up your shop before syncing.");
    setSyncStatus("syncing");
    setSyncMessage("");
    try {
      const result = await runSync();
      setSyncStatus("synced");
      setSyncMessage(`Backup complete · ${result.productCount} products · ${result.saleCount} sales`);
      await refresh();
      return result;
    } catch (error) {
      setSyncStatus("error");
      setSyncMessage(error.message || "Sync failed. Your local data is still available.");
      throw error;
    }
  }, [refresh, shopId]);

  useEffect(() => {
    if (!ready || !shopId || !userId) return undefined;
    const attemptScheduledBackup = () => {
      runScheduledBackupIfDue()
        .then((didBackup) => { if (didBackup) refresh(); })
        .catch((error) => {
          setSyncStatus("error");
          setSyncMessage(error.message || "Scheduled backup failed.");
        });
    };
    attemptScheduledBackup();
    Promise.resolve().then(() => syncNow()).catch((error) => console.error("Sync on app open failed.", error));
    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncNow().catch((error) => console.error("Automatic shop sync failed.", error));
      }
    });
    const appSubscription = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        syncNow().catch((error) => console.error("Sync on app foreground failed.", error));
      }
    });
    return () => {
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [ready, refresh, userId, shopId, syncNow]);

  const createShop = useCallback(async ({ name, ownerName, phone, address }) => {
    if (!name.trim() || !ownerName.trim()) throw new Error("Shop name and owner name are required.");
    await saveLocalShop({
      id: Crypto.randomUUID(),
      name,
      ownerName,
      phone,
      address,
      currency: "NPR",
    });
    await refresh();
  }, [refresh]);

  const saveProduct = useCallback(async (values, existing = null) => {
    if (!shop) throw new Error("Create your local shop profile first.");
    if (!values.name?.trim() || !values.sku?.trim() || Number(values.sellingPrice) <= 0) {
      throw new Error("Product name, SKU, and a valid selling price are required.");
    }
    await saveProductLocal(
      shop.id,
      { ...values, id: existing?.id || Crypto.randomUUID(), operationId: Crypto.randomUUID() },
      existing?.id || null,
      existing && Number(existing.version) > 0 ? Number(existing.version) : null,
    );
    await refresh();
  }, [refresh, shop]);

  const archiveProduct = useCallback(async (product) => {
    if (!shop) throw new Error("Create your local shop profile first.");
    await archiveProductLocal(shop.id, product.id, Crypto.randomUUID());
    await refresh();
  }, [refresh, shop]);

  const addToCart = useCallback((product) => {
    if (Number(product.stock_qty) <= 0) {
      const message = "This product is out of stock.";
      setCartNotice(message);
      return message;
    }
    const line = cart.find((item) => item.product.id === product.id);
    if (line && line.quantity >= Number(product.stock_qty)) {
      const message = `Only ${product.stock_qty} ${product.unit || "units"} of ${product.name} are available.`;
      setCartNotice(message);
      return message;
    }
    setCart((current) => line
      ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      : [...current, { product, quantity: 1 }]);
    setCartNotice("");
    return true;
  }, [cart]);

  const changeCartQuantity = useCallback((productId, delta) => {
    setCart((current) => current.map((item) => {
      if (item.product.id !== productId) return item;
      return { ...item, quantity: Math.max(0, Math.min(Number(item.product.stock_qty), item.quantity + delta)) };
    }).filter((item) => item.quantity > 0));
  }, []);

  const completeSale = useCallback(async (cart, paymentMethod, amountReceived, discount = 0, customerName = "Walk-in Customer") => {
    if (!shop) throw new Error("Create your local shop profile first.");
    const sale = await recordSaleLocal(
      shop.id,
      { requestId: Crypto.randomUUID(), items: cart },
      paymentMethod,
      Number(amountReceived),
      Number(discount || 0),
      0,
      customerName,
    );
    setCart([]);
    await refresh();
    setSyncMessage("Sale saved on this device. It will sync when connected.");
    return sale;
  }, [refresh, shop]);

  const signIn = useCallback(async (email, password, createAccount = false) => {
    if (!cloudConfigured || !supabase) {
      throw new Error("Configure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env first.");
    }
    const result = createAccount
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (createAccount && !result.data.session) {
      setSyncMessage("Check your email to confirm the new account, then sign in to sync.");
      return;
    }
    setSession(result.data.session);
    if (shop) await syncNow();
  }, [shop, syncNow]);

  const updateBackupSchedule = useCallback(async (nextTime, nextInterval) => {
    const parsedDays = Number(nextInterval);
    if (!/^\d{2}:\d{2}$/.test(nextTime) || !Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 365) {
      throw new Error("Choose a valid backup time and an interval from 1 to 365 days.");
    }
    const [hour, minute] = nextTime.split(":").map(Number);
    if (hour > 23 || minute > 59) throw new Error("Backup time must be between 00:00 and 23:59.");
    await setSetting("backup_time", nextTime);
    await setSetting("backup_interval_days", String(parsedDays));
    setBackupTime(nextTime);
    setBackupInterval(String(parsedDays));
  }, []);

  const resolveConflict = useCallback(async (conflict, strategy) => {
    if (conflict.entity_type !== "product") {
      throw new Error("This sale conflict needs an owner to review stock and payment records.");
    }
    await resolveProductConflict(conflict, strategy);
    await refresh();
  }, [refresh]);

  const value = useMemo(() => ({
    ready, shop, products, sales, conflicts, cart, cartNotice, session, cloudConfigured,
    backupTime, backupInterval, lastBackupAt, syncStatus, syncMessage,
    refresh, createShop, saveProduct, archiveProduct, addToCart, changeCartQuantity, completeSale, signIn, syncNow,
    updateBackupSchedule, resolveConflict,
  }), [
    ready, shop, products, sales, conflicts, cart, cartNotice, session, backupTime, backupInterval,
    lastBackupAt, syncStatus, syncMessage, refresh, createShop, saveProduct, archiveProduct,
    addToCart, changeCartQuantity, completeSale, signIn, syncNow, updateBackupSchedule, resolveConflict,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside StoreProvider.");
  return value;
}
