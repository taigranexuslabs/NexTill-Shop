import * as Crypto from "expo-crypto";
import * as Network from "expo-network";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import { cloudConfigured, supabase } from "./supabase";
import { cacheCloudProductImage } from "./productImages";
import {
  getDatabase,
  getLocalShop,
  getSetting,
  readOutbox,
  setSetting,
} from "./database";

const SYNC_DEVICE_KEY = "sync_device_id";
let activeSync = null;

function throwOnError(error, operation) {
  if (error) throw new Error(`${operation}: ${error.message || String(error)}`);
}

async function ensureDeviceId(userId) {
  const key = `${SYNC_DEVICE_KEY}:${userId}`;
  let id = await getSetting(key);
  if (!id) {
    id = Crypto.randomUUID();
    await setSetting(key, id);
  }
  return id;
}

async function ensureCloudShop(shop, user) {
  let cloudShopId = await getSetting("cloud_shop_id");
  const associatedUserId = await getSetting("cloud_shop_user_id");
  if (cloudShopId && associatedUserId === user.id) return cloudShopId;

  const { data: memberships, error: membershipError } = await supabase
    .from("shop_members")
    .select("shop_id, role")
    .eq("user_id", user.id)
    .limit(2);
  throwOnError(membershipError, "Load shop memberships");

  if (memberships?.length > 1) {
    throw new Error("This account belongs to multiple shops. Choose a shop before syncing.");
  }

  if (memberships?.length === 1) {
    cloudShopId = memberships[0].shop_id;
    const db = await getDatabase();
    await db.runAsync(
      "INSERT INTO local_settings (key, value) VALUES ('cloud_shop_id', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      cloudShopId,
    );
    await setSetting("cloud_shop_user_id", user.id);
    return cloudShopId;
  }

  const { data, error } = await supabase.rpc("create_shop", {
    p_name: shop.name,
    p_phone: shop.phone,
    p_address: shop.address,
    p_owner_name: shop.owner_name,
    p_shop_id: shop.id,
  });
  throwOnError(error, "Create cloud shop");
  cloudShopId = data.id;
  await setSetting("cloud_shop_id", cloudShopId);
  await setSetting("cloud_shop_user_id", user.id);
  return cloudShopId;
}

async function addConflict(shopId, row, reason, serverPayload = null) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_conflicts
      (id, shop_id, entity_type, entity_id, local_payload, server_payload, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    row.id,
    shopId,
    row.entity_type,
    row.entity_id,
    row.payload,
    serverPayload ? JSON.stringify(serverPayload) : null,
    reason,
    new Date().toISOString(),
  );
  await db.runAsync("UPDATE outbox SET status = 'conflict', last_error = ? WHERE id = ?", reason, row.id);
}

async function prepareProductForCloud(payload, cloudShopId) {
  if (!payload.image_url?.startsWith("file://")) return payload;
  if (payload.cloud_image_url) return { ...payload, image_url: payload.cloud_image_url };

  const file = new File(payload.image_url);
  if (!file.exists) throw new Error("The product photo is missing from this device. Retake it before syncing.");
  const filename = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
  const path = `${cloudShopId}/${payload.id}/${filename}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    contentType: "image/jpeg",
    upsert: true,
  });
  throwOnError(error, "Upload product photo");
  return { ...payload, image_url: path };
}

async function downloadCloudProductImage(productId, imagePath) {
  const { data, error } = await supabase.storage.from("product-images").createSignedUrl(imagePath, 60);
  throwOnError(error, "Create product photo download link");
  return cacheCloudProductImage(productId, data.signedUrl);
}

async function pushOutbox(shopId, cloudShopId) {
  const db = await getDatabase();
  const queue = await readOutbox(shopId);

  for (const item of queue) {
    const payload = JSON.parse(item.payload);
    if (item.entity_type === "product") {
      const cloudPayload = await prepareProductForCloud(payload, cloudShopId);
      const { data, error } = await supabase.rpc("upsert_product", {
        p_shop_id: cloudShopId,
        p_product: cloudPayload,
        p_expected_version: item.expected_version,
      });
      if (error) {
        if (error.code === "23505" || error.code === "23514") {
          await addConflict(shopId, item, error.message);
          continue;
        }
        throwOnError(error, "Sync product");
      }
      if (data.status === "conflict") {
        await addConflict(shopId, item, "The product changed on another device.", data.server);
        continue;
      }
      const serverProduct = data.product;
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE products SET version = ?, updated_at = ?, cloud_image_url = ? WHERE id = ? AND shop_id = ?",
          serverProduct.version,
          serverProduct.updated_at,
          serverProduct.image_url || null,
          item.entity_id,
          shopId,
        );
        await db.runAsync("DELETE FROM outbox WHERE id = ?", item.id);
      });
    } else if (item.entity_type === "sale") {
      const { data, error } = await supabase.rpc("complete_sale", {
        p_shop_id: cloudShopId,
        p_request_id: payload.request_id,
        p_items: payload.items,
        p_discount: payload.discount,
        p_tax: payload.tax,
        p_payment_method: payload.payment_method,
        p_amount_received: payload.amount_received,
      });
      if (error) {
        if (error.code === "23514" || error.code === "P0002" || error.code === "22023") {
          await addConflict(shopId, item, error.message);
          continue;
        }
        throwOnError(error, "Sync sale");
      }
      if (data.status === "conflict") {
        await addConflict(shopId, item, data.reason || "Sale requires review.", data.product);
        continue;
      }
      const invoiceId = data.invoice_id
        || `INV-${String(data.sale?.invoice_number || "").padStart(6, "0")}`;
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "UPDATE sales SET invoice_no = ?, status = 'synced' WHERE id = ? AND shop_id = ?",
          invoiceId,
          item.entity_id,
          shopId,
        );
        await db.runAsync("DELETE FROM outbox WHERE id = ?", item.id);
      });
    }
  }
}

async function pullCloudData(shopId, cloudShopId) {
  const db = await getDatabase();
  const { data: remoteProducts, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("shop_id", cloudShopId)
    .eq("active", true)
    .order("name")
    .limit(1000);
  throwOnError(productError, "Download products");
  const { data: remoteBarcodes, error: barcodeError } = await supabase
    .from("product_barcodes")
    .select("product_id, barcode")
    .eq("shop_id", cloudShopId)
    .eq("active", true);
  throwOnError(barcodeError, "Download product barcodes");
  const barcodesByProduct = new Map();
  for (const row of remoteBarcodes || []) {
    const barcodes = barcodesByProduct.get(row.product_id) || [];
    barcodes.push(row.barcode);
    barcodesByProduct.set(row.product_id, barcodes);
  }

  const localProducts = await db.getAllAsync("SELECT * FROM products WHERE shop_id = ?", shopId);
  const queued = await db.getAllAsync(
    "SELECT entity_id, expected_version FROM outbox WHERE shop_id = ? AND entity_type = 'product' AND status = 'pending'",
    shopId,
  );
  const pendingIds = new Set(queued.map((row) => row.entity_id));
  const localById = new Map(localProducts.map((row) => [row.id, row]));

  for (const remote of remoteProducts || []) {
    const local = localById.get(remote.id);
    if (local && pendingIds.has(remote.id)) {
      if (Number(local.version) !== Number(remote.version)) {
        await db.runAsync(
          `INSERT OR IGNORE INTO sync_conflicts
            (id, shop_id, entity_type, entity_id, local_payload, server_payload, reason, created_at)
           VALUES (?, ?, 'product', ?, ?, ?, ?, ?)`,
          Crypto.randomUUID(),
          shopId,
          remote.id,
          JSON.stringify(local),
          JSON.stringify(remote),
          "A product was edited on another device.",
          new Date().toISOString(),
        );
      }
      continue;
    }

    let localImageUrl = local?.image_url || null;
    if (remote.image_url && local?.cloud_image_url !== remote.image_url) {
      localImageUrl = await downloadCloudProductImage(remote.id, remote.image_url);
    } else if (!remote.image_url) {
      localImageUrl = null;
    }

    await db.runAsync(
      `INSERT INTO products
        (id, shop_id, name, sku, barcode, category, unit, image_url, cloud_image_url, cost_price, selling_price,
         stock_qty, low_stock_threshold, active, version, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, sku = excluded.sku, barcode = excluded.barcode,
         category = excluded.category, unit = excluded.unit, image_url = excluded.image_url,
         cloud_image_url = excluded.cloud_image_url, cost_price = excluded.cost_price,
         selling_price = excluded.selling_price, stock_qty = excluded.stock_qty,
         low_stock_threshold = excluded.low_stock_threshold, active = excluded.active,
         version = excluded.version, updated_at = excluded.updated_at`,
      remote.id,
      shopId,
      remote.name,
      remote.sku,
      remote.barcode,
      remote.category || "Others",
      remote.unit,
      localImageUrl,
      remote.image_url || null,
      remote.cost_price,
      remote.selling_price,
      remote.stock_qty,
      remote.low_stock_threshold,
      remote.active ? 1 : 0,
      remote.version,
      remote.updated_at,
    );
    const barcodes = barcodesByProduct.get(remote.id) || (remote.barcode ? [remote.barcode] : []);
    await db.runAsync(
      "DELETE FROM product_barcodes WHERE shop_id = ? AND product_id = ?",
      shopId,
      remote.id,
    );
    for (const barcode of barcodes) {
      await db.runAsync(
        "INSERT INTO product_barcodes (shop_id, product_id, barcode, active) VALUES (?, ?, ?, 1)",
        shopId,
        remote.id,
        barcode,
      );
    }
  }

  const { data: remoteSales, error: salesError } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .eq("shop_id", cloudShopId)
    .order("created_at", { ascending: false })
    .limit(250);
  throwOnError(salesError, "Download sales");

  for (const sale of remoteSales || []) {
    const paidAmount = Math.min(
      Number(sale.total),
      Math.max(0, Number(sale.amount_received) - Number(sale.change_due || 0)),
    );
    const localSale = sale.request_id
      ? await db.getFirstAsync("SELECT id FROM sales WHERE id = ? AND shop_id = ?", sale.request_id, shopId)
      : null;
    const localSaleId = localSale?.id || sale.id;
    await db.runAsync(
      `INSERT OR IGNORE INTO sales
        (id, shop_id, invoice_no, customer_name, subtotal, discount, tax, total,
         amount_received, change_due, outstanding_amount, payment_method, status, created_at, note)
       VALUES (?, ?, ?, 'Walk-in Customer', ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
      localSaleId,
      shopId,
      `INV-${String(sale.invoice_number).padStart(6, "0")}`,
      sale.subtotal,
      sale.discount,
      sale.tax,
      sale.total,
      sale.amount_received,
      sale.change_due,
      Number(sale.total) - paidAmount,
      sale.payment_method,
      sale.created_at,
      sale.note,
    );
    if (!localSale) for (const line of sale.sale_items || []) {
      await db.runAsync(
        `INSERT OR IGNORE INTO sale_items
          (id, sale_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        line.id,
        localSaleId,
        line.product_id || "",
        line.product_name_snapshot,
        line.sku_snapshot,
        line.quantity,
        line.unit_price,
        line.unit_cost_snapshot,
        line.line_total,
      );
    }
    if (!localSale && paidAmount > 0) {
      await db.runAsync(
        `INSERT OR IGNORE INTO sale_payments (id, shop_id, sale_id, amount, payment_method, paid_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        `${localSaleId}:initial`,
        shopId,
        localSaleId,
        paidAmount,
        sale.payment_method,
        sale.created_at,
      );
    }
  }
}

async function performSync() {
  if (!cloudConfigured || !supabase) {
    throw new Error("Cloud backup is not configured. Add the Supabase URL and anon key to mobile/.env.");
  }
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error("You are offline. Your data is saved on this device and will sync when internet returns.");
  }

  const [{ data: sessionData, error: sessionError }, shop] = await Promise.all([
    supabase.auth.getSession(),
    getLocalShop(),
  ]);
  throwOnError(sessionError, "Check account session");
  if (!shop) throw new Error("Set up your shop on this device before syncing.");
  if (!sessionData.session?.user) throw new Error("Sign in to your Supabase account to sync backups.");

  const user = sessionData.session.user;
  const cloudShopId = await ensureCloudShop(shop, user);
  await pushOutbox(shop.id, cloudShopId);
  await pullCloudData(shop.id, cloudShopId);

  const deviceId = await ensureDeviceId(user.id);
  const db = await getDatabase();
  const products = await db.getAllAsync("SELECT * FROM products WHERE shop_id = ? AND active = 1", shop.id);
  const sales = await db.getAllAsync("SELECT * FROM sales WHERE shop_id = ? ORDER BY created_at DESC LIMIT 1000", shop.id);
  const saleItems = await db.getAllAsync(
    `SELECT i.* FROM sale_items i
     JOIN sales s ON s.id = i.sale_id
     WHERE s.shop_id = ?
     ORDER BY s.created_at DESC`,
    shop.id,
  );
  const salePayments = await db.getAllAsync(
    "SELECT * FROM sale_payments WHERE shop_id = ? ORDER BY paid_at",
    shop.id,
  );
  const itemsBySale = new Map();
  const paymentsBySale = new Map();
  for (const item of saleItems) {
    const items = itemsBySale.get(item.sale_id) || [];
    items.push(item);
    itemsBySale.set(item.sale_id, items);
  }
  for (const payment of salePayments) {
    const payments = paymentsBySale.get(payment.sale_id) || [];
    payments.push(payment);
    paymentsBySale.set(payment.sale_id, payments);
  }
  const salesWithItems = sales.map((sale) => {
    const saleSnapshot = { ...sale };
    delete saleSnapshot.customer_photo_uri;
    return {
      ...saleSnapshot,
      items: itemsBySale.get(sale.id) || [],
      payments: paymentsBySale.get(sale.id) || [],
    };
  });
  const pending = await db.getAllAsync("SELECT * FROM outbox WHERE shop_id = ?", shop.id);
  const settings = await db.getAllAsync("SELECT key, value FROM local_settings");
  const payload = { schemaVersion: 2, shop, products, sales: salesWithItems, pending, settings, backedUpAt: new Date().toISOString() };
  const { data: backupId, error: backupError } = await supabase.rpc("save_backup_snapshot", {
    p_shop_id: cloudShopId,
    p_device_id: deviceId,
    p_payload: payload,
    p_record_count: products.length + sales.length,
  });
  throwOnError(backupError, "Save cloud backup");

  const now = new Date().toISOString();
  await setSetting("last_backup_at", now);
  await setSetting("last_sync_at", now);
  await setSetting("last_backup_id", backupId);
  const { error: deviceError } = await supabase.from("sync_devices").upsert({
    id: deviceId,
    shop_id: cloudShopId,
    user_id: user.id,
    device_name: `${Platform.OS} shop device`,
    platform: Platform.OS === "ios" ? "ios" : "android",
    last_seen_at: now,
    last_backup_at: now,
    backup_time: (await getSetting("backup_time", "06:00")) + ":00",
    backup_interval_days: Number(await getSetting("backup_interval_days", "1")),
    backup_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kathmandu",
  });
  throwOnError(deviceError, "Update device sync status");
  return { backupId, productCount: products.length, saleCount: sales.length };
}

export function runSync() {
  if (!activeSync) {
    activeSync = performSync().finally(() => {
      activeSync = null;
    });
  }
  return activeSync;
}

export async function runScheduledBackupIfDue() {
  const intervalDays = Number(await getSetting("backup_interval_days", "1"));
  const backupTime = await getSetting("backup_time", "06:00");
  const lastBackupAt = await getSetting("last_backup_at");
  const [hours, minutes] = backupTime.split(":").map(Number);
  const now = new Date();
  const due = lastBackupAt ? new Date(lastBackupAt) : new Date(now);
  if (lastBackupAt) due.setDate(due.getDate() + intervalDays);
  due.setHours(hours, minutes, 0, 0);
  if (now < due) return false;
  await runSync();
  return true;
}

export async function resolveProductConflict(conflict, strategy) {
  const db = await getDatabase();
  const local = JSON.parse(conflict.local_payload);
  const server = conflict.server_payload ? JSON.parse(conflict.server_payload) : null;
  if (strategy === "server" && server) {
    const cloudShopId = await getSetting("cloud_shop_id");
    let serverBarcodes = server.barcode ? [server.barcode] : [];
    if (cloudShopId) {
      const { data, error } = await supabase
        .from("product_barcodes")
        .select("barcode")
        .eq("shop_id", cloudShopId)
        .eq("product_id", conflict.entity_id)
        .eq("active", true);
      throwOnError(error, "Load product barcodes");
      serverBarcodes = (data || []).map((item) => item.barcode);
    }
    const imageUrl = server.image_url
      ? await downloadCloudProductImage(conflict.entity_id, server.image_url)
      : null;
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE products SET name = ?, sku = ?, barcode = ?, category = ?, unit = ?,
          image_url = ?, cloud_image_url = ?, cost_price = ?, selling_price = ?, stock_qty = ?,
          low_stock_threshold = ?, active = ?, version = ?, updated_at = ? WHERE id = ? AND shop_id = ?`,
        server.name,
        server.sku,
        server.barcode,
        server.category || "Others",
        server.unit,
        imageUrl,
        server.image_url || null,
        server.cost_price,
        server.selling_price,
        server.stock_qty,
        server.low_stock_threshold,
        server.active ? 1 : 0,
        server.version,
        server.updated_at,
        conflict.entity_id,
        conflict.shop_id,
      );
      await db.runAsync(
        "DELETE FROM product_barcodes WHERE shop_id = ? AND product_id = ?",
        conflict.shop_id,
        conflict.entity_id,
      );
      for (const barcode of serverBarcodes) {
        await db.runAsync(
          "INSERT INTO product_barcodes (shop_id, product_id, barcode, active) VALUES (?, ?, ?, ?)",
          conflict.shop_id,
          conflict.entity_id,
          barcode,
          server.active ? 1 : 0,
        );
      }
      await db.runAsync(
        "DELETE FROM outbox WHERE shop_id = ? AND entity_type = 'product' AND entity_id = ?",
        conflict.shop_id,
        conflict.entity_id,
      );
    });
  } else if (strategy === "local") {
    const operationId = Crypto.randomUUID();
    const payload = { ...local, category_id: local.category, stock_qty: local.stock_qty };
    await db.runAsync(
      `INSERT INTO outbox
        (id, shop_id, entity_type, entity_id, operation, payload, expected_version, created_at)
       VALUES (?, ?, 'product', ?, 'upsert', ?, ?, ?)`,
      operationId,
      conflict.shop_id,
      conflict.entity_id,
      JSON.stringify(payload),
      server?.version ?? null,
      new Date().toISOString(),
    );
    await db.runAsync("UPDATE products SET version = ? WHERE id = ?", server?.version ?? 0, conflict.entity_id);
  }
  await db.runAsync("UPDATE sync_conflicts SET status = 'resolved' WHERE id = ?", conflict.id);
}
