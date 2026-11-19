import * as SQLite from "expo-sqlite";

let databasePromise;

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("nextill-shop.db").then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS local_shops (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          owner_name TEXT NOT NULL,
          phone TEXT,
          address TEXT,
          currency TEXT NOT NULL DEFAULT 'NPR',
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sku TEXT NOT NULL,
          barcode TEXT,
          category TEXT NOT NULL DEFAULT 'Others',
          unit TEXT NOT NULL DEFAULT 'unit',
          image_url TEXT,
          cloud_image_url TEXT,
          cost_price REAL NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
          selling_price REAL NOT NULL CHECK (selling_price >= 0),
          stock_qty REAL NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
          low_stock_threshold REAL NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
          active INTEGER NOT NULL DEFAULT 1,
          version INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL,
          UNIQUE(shop_id, sku)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_unique
          ON products(shop_id, barcode) WHERE barcode IS NOT NULL AND active = 1;
        CREATE TABLE IF NOT EXISTS product_barcodes (
          shop_id TEXT NOT NULL,
          product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          barcode TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1,
          UNIQUE (product_id, barcode)
        );
        CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_active_unique
          ON product_barcodes(shop_id, barcode) WHERE active = 1;
        CREATE INDEX IF NOT EXISTS product_barcodes_product_idx
          ON product_barcodes(shop_id, product_id);
        CREATE TABLE IF NOT EXISTS sales (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          invoice_no TEXT NOT NULL,
          customer_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
          subtotal REAL NOT NULL,
          discount REAL NOT NULL DEFAULT 0,
          tax REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL,
          amount_received REAL NOT NULL,
          change_due REAL NOT NULL DEFAULT 0,
          payment_method TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending_sync',
          created_at TEXT NOT NULL,
          note TEXT
        );
        CREATE TABLE IF NOT EXISTS sale_items (
          id TEXT PRIMARY KEY NOT NULL,
          sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
          product_id TEXT NOT NULL,
          name_snapshot TEXT NOT NULL,
          sku_snapshot TEXT NOT NULL,
          quantity REAL NOT NULL CHECK (quantity > 0),
          unit_price REAL NOT NULL CHECK (unit_price >= 0),
          unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
          line_total REAL NOT NULL CHECK (line_total >= 0)
        );
        CREATE TABLE IF NOT EXISTS outbox (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          payload TEXT NOT NULL,
          expected_version INTEGER,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL,
          last_error TEXT
        );
        CREATE INDEX IF NOT EXISTS outbox_pending_idx ON outbox(status, created_at);
        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id TEXT PRIMARY KEY NOT NULL,
          shop_id TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          local_payload TEXT NOT NULL,
          server_payload TEXT,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open'
        );
        CREATE TABLE IF NOT EXISTS local_settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      const productColumns = await db.getAllAsync("PRAGMA table_info(products)");
      if (!productColumns.some((column) => column.name === "image_url")) {
        await db.execAsync("ALTER TABLE products ADD COLUMN image_url TEXT");
      }
      if (!productColumns.some((column) => column.name === "cloud_image_url")) {
        await db.execAsync("ALTER TABLE products ADD COLUMN cloud_image_url TEXT");
      }
      await db.runAsync(
        `INSERT OR IGNORE INTO product_barcodes (shop_id, product_id, barcode, active)
         SELECT shop_id, id, barcode, active
         FROM products WHERE active = 1 AND barcode IS NOT NULL AND trim(barcode) <> ''`,
      );
      return db;
    });
  }
  return databasePromise;
}

export async function getSetting(key, fallback = null) {
  const db = await getDatabase();
  const row = await db.getFirstAsync("SELECT value FROM local_settings WHERE key = ?", key);
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    String(value),
  );
}

export async function getLocalShop() {
  const db = await getDatabase();
  return db.getFirstAsync("SELECT * FROM local_shops LIMIT 1");
}

export async function saveLocalShop(shop) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO local_shops (id, name, owner_name, phone, address, currency, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    shop.id,
    shop.name.trim(),
    shop.ownerName.trim(),
    shop.phone || null,
    shop.address || null,
    shop.currency || "NPR",
    new Date().toISOString(),
  );
  await setSetting("shop_id", shop.id);
}

export async function readProducts(shopId) {
  const db = await getDatabase();
  const products = await db.getAllAsync(
    "SELECT * FROM products WHERE shop_id = ? AND active = 1 ORDER BY name COLLATE NOCASE",
    shopId,
  );
  const barcodes = await db.getAllAsync(
    "SELECT product_id, barcode FROM product_barcodes WHERE shop_id = ? AND active = 1 ORDER BY barcode",
    shopId,
  );
  const barcodesByProduct = new Map();
  for (const row of barcodes) {
    const values = barcodesByProduct.get(row.product_id) || [];
    values.push(row.barcode);
    barcodesByProduct.set(row.product_id, values);
  }
  return products.map((product) => ({
    ...product,
    barcodes: barcodesByProduct.get(product.id) || (product.barcode ? [product.barcode] : []),
  }));
}

export async function readSales(shopId, limit = 100) {
  const db = await getDatabase();
  const sales = await db.getAllAsync(
    "SELECT * FROM sales WHERE shop_id = ? ORDER BY created_at DESC LIMIT ?",
    shopId,
    limit,
  );
  for (const sale of sales) {
    sale.items = await db.getAllAsync(
      "SELECT * FROM sale_items WHERE sale_id = ? ORDER BY rowid",
      sale.id,
    );
  }
  return sales;
}

export async function saveProductLocal(shopId, values, productId, expectedVersion = null) {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = productId || values.id;
  const barcodes = [...new Set(
    [values.barcode, ...(values.barcodes || [])]
      .map((barcode) => String(barcode || "").trim())
      .filter(Boolean),
  )];
  if (barcodes.some((barcode) => barcode.length > 128)) {
    throw new Error("Barcodes must be 128 characters or fewer.");
  }
  const product = {
    id,
    shop_id: shopId,
    name: values.name.trim(),
    sku: values.sku.trim(),
    barcode: barcodes[0] || null,
    barcodes,
    category: values.category || "Others",
    unit: values.unit || "unit",
    image_url: values.imageUrl?.trim() || null,
    cost_price: Number(values.costPrice || 0),
    selling_price: Number(values.sellingPrice),
    stock_qty: Number(values.stockQty || 0),
    low_stock_threshold: Number(values.lowStockThreshold || 0),
    active: 1,
    version: Number(values.version || 0),
    updated_at: now,
  };
  await db.withTransactionAsync(async () => {
    for (const barcode of barcodes) {
      const owner = await db.getFirstAsync(
        `SELECT p.name FROM product_barcodes b
         JOIN products p ON p.id = b.product_id AND p.shop_id = b.shop_id
         WHERE b.shop_id = ? AND b.barcode = ? AND b.active = 1 AND b.product_id <> ?`,
        shopId,
        barcode,
        id,
      );
      if (owner) throw new Error(`Barcode ${barcode} is already assigned to ${owner.name}.`);
    }

    if (productId) {
      const existing = await db.getFirstAsync(
        "SELECT image_url, cloud_image_url FROM products WHERE id = ? AND shop_id = ?",
        id,
        shopId,
      );
      product.cloud_image_url = existing?.image_url === product.image_url
        ? existing.cloud_image_url
        : null;
      await db.runAsync(
        `UPDATE products SET name = ?, sku = ?, barcode = ?, category = ?, unit = ?,
          image_url = ?, cloud_image_url = ?, cost_price = ?, selling_price = ?,
          low_stock_threshold = ?, updated_at = ?
         WHERE id = ? AND shop_id = ?`,
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.unit,
        product.image_url,
        product.cloud_image_url,
        product.cost_price,
        product.selling_price,
        product.low_stock_threshold,
        now,
        id,
        shopId,
      );
    } else {
      await db.runAsync(
        `INSERT INTO products
          (id, shop_id, name, sku, barcode, category, unit, image_url, cloud_image_url, cost_price, selling_price,
           stock_qty, low_stock_threshold, active, version, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1, 0, ?)`,
        product.id,
        product.shop_id,
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.unit,
        product.image_url,
        product.cost_price,
        product.selling_price,
        product.stock_qty,
        product.low_stock_threshold,
        now,
      );
    }
    await db.runAsync("DELETE FROM product_barcodes WHERE shop_id = ? AND product_id = ?", shopId, id);
    for (const barcode of barcodes) {
      await db.runAsync(
        "INSERT INTO product_barcodes (shop_id, product_id, barcode, active) VALUES (?, ?, ?, 1)",
        shopId,
        id,
        barcode,
      );
    }
    await db.runAsync(
      `DELETE FROM outbox
       WHERE shop_id = ? AND entity_type = 'product' AND entity_id = ? AND status = 'pending'`,
      shopId,
      id,
    );
    await db.runAsync(
      `INSERT INTO outbox (id, shop_id, entity_type, entity_id, operation, payload, expected_version, created_at)
       VALUES (?, ?, 'product', ?, 'upsert', ?, ?, ?)`,
      values.operationId,
      shopId,
      id,
      JSON.stringify(product),
      expectedVersion,
      now,
    );
  });
  return product;
}

export async function archiveProductLocal(shopId, productId, operationId) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const product = await db.getFirstAsync(
      "SELECT * FROM products WHERE id = ? AND shop_id = ? AND active = 1",
      productId,
      shopId,
    );
    if (!product) throw new Error("This product is no longer in your active inventory.");

    const saleOutbox = await db.getAllAsync(
      "SELECT payload FROM outbox WHERE shop_id = ? AND entity_type = 'sale' AND status IN ('pending', 'conflict')",
      shopId,
    );
    for (const row of saleOutbox) {
      const sale = JSON.parse(row.payload);
      if (sale.items?.some((item) => item.product_id === productId)) {
        throw new Error("This product is part of a sale that has not synced yet. Sync or resolve that sale before deleting the product.");
      }
    }

    const conflict = await db.getFirstAsync(
      "SELECT id FROM sync_conflicts WHERE shop_id = ? AND entity_type = 'product' AND entity_id = ? AND status = 'open'",
      shopId,
      productId,
    );
    if (conflict) throw new Error("Resolve this product's sync conflict before deleting it.");

    const now = new Date().toISOString();
    const barcodes = await db.getAllAsync(
      "SELECT barcode FROM product_barcodes WHERE shop_id = ? AND product_id = ? ORDER BY barcode",
      shopId,
      productId,
    );
    const payload = {
      ...product,
      barcodes: barcodes.map((item) => item.barcode),
      active: 0,
      updated_at: now,
    };
    await db.runAsync(
      "UPDATE products SET active = 0, updated_at = ? WHERE id = ? AND shop_id = ?",
      now,
      productId,
      shopId,
    );
    await db.runAsync("DELETE FROM product_barcodes WHERE shop_id = ? AND product_id = ?", shopId, productId);
    const pendingProduct = await db.getFirstAsync(
      "SELECT id FROM outbox WHERE shop_id = ? AND entity_type = 'product' AND entity_id = ? AND status = 'pending'",
      shopId,
      productId,
    );
    if (pendingProduct) {
      await db.runAsync(
        "UPDATE outbox SET payload = ?, expected_version = ? WHERE id = ?",
        JSON.stringify(payload),
        Number(product.version) > 0 ? Number(product.version) : null,
        pendingProduct.id,
      );
    } else {
      await db.runAsync(
        `INSERT INTO outbox (id, shop_id, entity_type, entity_id, operation, payload, expected_version, created_at)
         VALUES (?, ?, 'product', ?, 'upsert', ?, ?, ?)`,
        operationId,
        shopId,
        productId,
        JSON.stringify(payload),
        Number(product.version) > 0 ? Number(product.version) : null,
        now,
      );
    }
  });
}

export async function recordSaleLocal(shopId, cart, paymentMethod, amountReceived, discount = 0, tax = 0, customerName = "Walk-in Customer") {
  const db = await getDatabase();
  const saleId = cart.requestId;
  const now = new Date().toISOString();
  let subtotal = 0;
  const saleItems = [];

  await db.withTransactionAsync(async () => {
    for (const line of cart.items) {
      const product = await db.getFirstAsync(
        "SELECT * FROM products WHERE id = ? AND shop_id = ? AND active = 1",
        line.product.id,
        shopId,
      );
      if (!product) throw new Error(`Product "${line.product.name}" is no longer available.`);
      if (Number(product.stock_qty) < line.quantity) {
        throw new Error(`Not enough stock for ${product.name}. Available: ${product.stock_qty}.`);
      }
      const lineTotal = Number(product.selling_price) * line.quantity;
      subtotal += lineTotal;
      saleItems.push({ product, quantity: line.quantity, lineTotal });
    }

    if (discount < 0 || discount > subtotal) throw new Error("Discount must be between zero and the subtotal.");
    const total = Math.max(0, subtotal - discount + tax);
    if (paymentMethod === "cash" && amountReceived < total) {
      throw new Error("Amount received must cover the total.");
    }
    if (paymentMethod !== "cash" && amountReceived !== total) {
      throw new Error("Digital payment amount must match the sale total.");
    }

    const invoiceNo = `LOCAL-${saleId.slice(-8).toUpperCase()}`;
    await db.runAsync(
      `INSERT INTO sales
        (id, shop_id, invoice_no, customer_name, subtotal, discount, tax, total, amount_received,
         change_due, payment_method, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_sync', ?)`,
      saleId,
      shopId,
      invoiceNo,
      String(customerName || "").trim() || "Walk-in Customer",
      subtotal,
      discount,
      tax,
      total,
      amountReceived,
      Math.max(0, amountReceived - total),
      paymentMethod,
      now,
    );

    for (const { product, quantity, lineTotal } of saleItems) {
      const itemId = `${saleId}:${product.id}`;
      const updatedStock = Number(product.stock_qty) - quantity;
      await db.runAsync(
        `INSERT INTO sale_items
          (id, sale_id, product_id, name_snapshot, sku_snapshot, quantity, unit_price, unit_cost, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId,
        saleId,
        product.id,
        product.name,
        product.sku,
        quantity,
        product.selling_price,
        product.cost_price,
        lineTotal,
      );
      await db.runAsync(
        "UPDATE products SET stock_qty = ?, updated_at = ? WHERE id = ? AND shop_id = ?",
        updatedStock,
        now,
        product.id,
        shopId,
      );
    }

    await db.runAsync(
      `INSERT INTO outbox (id, shop_id, entity_type, entity_id, operation, payload, created_at)
       VALUES (?, ?, 'sale', ?, 'complete', ?, ?)`,
      saleId,
      shopId,
      saleId,
      JSON.stringify({
        request_id: saleId,
        items: saleItems.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity,
          unit_price: product.selling_price,
        })),
        discount,
        tax,
        payment_method: paymentMethod,
        amount_received: amountReceived,
      }),
      now,
    );
  });
  return db.getFirstAsync("SELECT * FROM sales WHERE id = ?", saleId);
}

export async function listConflicts(shopId) {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT * FROM sync_conflicts WHERE shop_id = ? AND status = 'open' ORDER BY created_at DESC",
    shopId,
  );
}

export async function readOutbox(shopId) {
  const db = await getDatabase();
  return db.getAllAsync(
    "SELECT * FROM outbox WHERE shop_id = ? AND status = 'pending' ORDER BY created_at ASC",
    shopId,
  );
}
