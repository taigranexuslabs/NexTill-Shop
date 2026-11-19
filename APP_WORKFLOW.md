# NexTill Shop: Application Workflow and Implementation Review

**Review date:** 2026-11-19  
**Scope:** Mobile application source in this repository. This document describes the code currently present; it is not a review of the deployed app or Supabase project.

## 1. Product overview

NexTill Shop is an Expo / React Native point-of-sale and shop-management app. Its primary workflow is designed to work offline:

1. A shop is created and stored on the device.
2. Products and inventory are stored in SQLite.
3. A sale is completed against local stock and saved atomically with its line items and a pending-sync outbox event.
4. When a cloud account and network are available, queued changes are sent to Supabase, cloud products and sales are downloaded, and a backup snapshot is uploaded.

Cloud backup is optional for local use. The screens currently offer product management, checkout, sales history, due-payment tracking, summary reporting, expenses, staff, customer summaries, and backup/account settings.

## 2. Application architecture

```text
Expo Router
  app/_layout.jsx                 Root stack and global StoreProvider
  app/(tabs)/_layout.jsx          Five visible tabs
  app/{settings,reports,expenses,customers,due-payments,staff}.jsx  Standalone secondary screens
  app/**/*.jsx                    Route-level screens
        |
        v
src/StoreProvider.jsx             Shared shop, products, sales, cart, auth and sync state
        |
        +--> src/lib/database.js  Local SQLite schema and local-first operations
        +--> src/lib/sync.js      Outbox push, cloud pull, conflicts, backup snapshots
        +--> src/lib/supabase.js  Supabase client and secure auth-session storage
        +--> src/lib/backgroundSync.js
        +--> src/lib/productImages.js
        |
        v
Supabase Auth / PostgREST / RPC / Storage
```

### Main layers

- **Navigation and screens:** Expo Router file-based routes live under `app/`. The root stack presents `scanner` and `checkout` as modals and registers standalone `settings`, `reports`, `expenses`, `customers`, `due-payments`, and `staff` routes. The tab navigator exposes only Home, Sales, New Sale, Products, and More. All secondary screens are root stack routes launched from More or Home.
- **Shared state:** `StoreProvider` initializes SQLite, loads the local shop/products/sales, and exposes screen actions through `useStore()`. The cart is held in React state, not persisted in SQLite.
- **Persistence:** `database.js` opens `nextill-shop.db`, creates tables/indexes, and contains local shop, product, sale, outbox, conflict, and settings operations.
- **Cloud:** `sync.js` uses the Supabase JavaScript client directly. There is no separate HTTP API client or backend server implementation in this repository.
- **Styling:** shared screen primitives and palette are in `src/components/Screen.jsx` and `src/theme.js`.

## 3. Screen-by-screen workflow

| Screen / route | How it is reached | Current behavior and data |
|---|---|---|
| Shop setup (component, not a route) | Shown by `AppScreen` whenever initialization is complete but no local shop exists | Collects shop name and owner (required), phone and address (optional). Creates one local shop with NPR currency. No sign-in or internet is required. |
| Home (`/(tabs)` / `app/(tabs)/index.jsx`) | First visible tab | Shows today’s sales, bill count, estimated profit, low stock, seven-day chart, best sellers, recent sales, and low-stock products. Values are calculated from the locally loaded sales/products. Backup indicator links to Settings. |
| Sales & Bills (`/(tabs)/sales`) | Sales tab or Home “View all” | Searches invoice/customer text, filters by date and payment method, and opens an invoice detail modal. Displays the locally loaded sale history and whether each sale is pending or synced. |
| New Sale (`/(tabs)/sale`) | Center tab or Home “New Sale” | Searches products by name or barcode, filters categories, adds in-stock products to the in-memory cart, and opens the scanner or checkout. |
| Barcode Scanner (`/scanner`, modal) | Scan action in New Sale | Requests camera permission only when scanning starts; supports EAN/UPC, Code 39/93, Codabar, Code 128, and QR formats, plus manual barcode lookup. A found product is added to the cart; an unknown code can be passed into Add Product. |
| Checkout (`/checkout`, modal) | View Cart | Adjusts cart quantities, accepts a flat-amount discount, records a payment type and amount paid, and calculates any remaining balance. An outstanding balance requires a customer name and phone number. An optional face photo is captured automatically when one face stays inside the on-screen guide; on-device face detection does not identify people. The photo stays in local app storage. Completing the sale writes the sale, initial payment, customer details, item snapshots, stock deductions, and outbox row in one local transaction. The completion screen links to the invoice or a new sale. Digital payment types are labels only; no provider verification takes place. |
| Products (`/(tabs)/products`) | Products tab; also unknown-barcode action | Lists local active inventory with search, category and stock filters. Add/edit supports product details, multiple barcodes, cost/selling prices, opening stock for new products, low-stock threshold, and an optional camera photo. Existing sales retain item snapshots. Deletion archives a product locally and queues a cloud update. |
| More (`/(tabs)/more`) | More tab | Shows the local shop/owner profile and links to Settings, Reports, Expenses, Customers, Due payments, and Staff. |
| Settings (`/settings`, `app/settings.jsx`) | More → Shop profile & backup; Home backup link | Standalone root-stack screen (not a tab). Shows the local shop profile, optional Supabase email sign-in/account creation, manual backup, a locally configured backup schedule, sign-out, and visible sync conflicts. The shop profile shown here is not editable. |
| Reports (`/reports`, `app/reports.jsx`) | More → Reports & analytics | Standalone root-stack screen (not a tab). Calculates total sales, average bill, estimated gross profit, and top products from the loaded sales. There are no date-range controls or export action. |
| Expenses (`/expenses`, `app/expenses.jsx`) | More → Expenses | Standalone root-stack screen (not a tab). Adds named amounts and dates to a JSON array in `local_settings`. Load/save failures are shown in the screen and a new expense is only displayed after SQLite confirms the write. This data is not modeled as a dedicated expense entity and is not included in sales/profit reporting. |
| Customers (`/customers`, `app/customers.jsx`) | More → Customers | Standalone root-stack screen (not a tab). Derives visit count and spend from sale rows grouped by customer name. Checkout accepts an optional customer name; unnamed sales remain “Walk-in Customer”. Remote sales pulled from Supabase do not currently include customer names, and name-based grouping can merge distinct people. |
| Due Payments (`/due-payments`, `app/due-payments.jsx`) | More → Due payments | Standalone root-stack screen (not a tab). Lists all sales with an outstanding balance, shows customer name, phone, optional face photo, and invoice details, and records full or partial follow-up payments with method and timestamp. The payment ledger and updated balance are stored locally. Optional face capture uses native Vision Camera and on-device ML Kit, so it requires a custom development or production build (Expo Go does not include its Nitro native modules); the local photo is not included in cloud snapshots. |
| Staff (`/staff`, `app/staff.jsx`) | More → Staff & employees | Standalone root-stack screen (not a tab). Shows the local shop owner and allows adding names/roles to a JSON array in `local_settings`. Load/save failures are shown and additions are only displayed after SQLite confirms the write. This is a local directory; it does not create user accounts, permissions, or staff-to-sale attribution. |

### Typical sale flow

```text
New Sale → search/filter or scan → add product(s) to cart
         → Checkout → adjust quantity / discount / amount paid
         → local SQLite transaction (sale + payment ledger + item snapshots + stock change + outbox)
         → success / invoice
         → More → Due payments → record follow-up payments until balance is zero
         → when online and signed in: Supabase complete_sale RPC
         → pull cloud data → upload backup snapshot
```

## 4. Local data model and behavior

The SQLite schema is created in `src/lib/database.js`.

| Table | Purpose |
|---|---|
| `local_shops` | One local shop profile, with name, owner, phone, address, currency, and creation time. |
| `products` | Shop inventory, prices, stock, low-stock threshold, image references, active flag, version, and update time. |
| `product_barcodes` | Multiple active barcode aliases per product, with active-code uniqueness per shop. |
| `sales` | Sale totals, payment method, received amount, change, outstanding balance, customer name and phone, optional local photo URI, status, invoice number, and timestamp. |
| `sale_items` | Immutable-at-sale-time name/price/cost/quantity/line-total snapshots linked to the sale. |
| `sale_payments` | Initial and follow-up customer payments, including amount, payment method, and timestamp. |
| `outbox` | Pending product and sale operations, serialized payloads, expected product versions, and errors/status. |
| `sync_conflicts` | Local/server payloads and reasons for operations that need review. |
| `local_settings` | Key/value settings, including backup schedule and currently JSON-serialized staff/expenses. |

Sale completion re-reads current product stock inside a transaction, rejects missing/insufficient stock, validates discount and payment amount, stores the sale and its initial payment, decrements stock, and enqueues the sale. Follow-up payments update the outstanding balance and append a payment record in one transaction. This protects local transaction consistency, but the client-side cart itself is not durable until checkout is completed.

## 5. Cloud integration and API surface

The mobile app configures Supabase from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Auth session values are stored through Expo SecureStore. When these environment variables are absent, local workflows remain available and cloud sync reports that it is not configured.

### Auth

- `supabase.auth.getSession()` loads the persisted session during initialization.
- `signInWithPassword({ email, password })` signs in.
- `signUp({ email, password })` creates an account; if no session is returned, the screen asks the user to confirm through email and then sign in.
- `supabase.auth.signOut()` signs out without deleting local shop data.

### Tables read or written

| Supabase resource | Use in app |
|---|---|
| `shop_members` | Looks up the signed-in user’s shop membership before creating/associating a cloud shop. More than one membership currently stops sync with a “choose a shop” error. |
| `products` | Downloads up to 1,000 active products for the associated cloud shop. |
| `product_barcodes` | Downloads active barcode aliases and looks them up when resolving product conflicts. |
| `sales` with nested `sale_items` | Downloads up to 250 recent cloud sales. |
| `sync_devices` | Upserts device/platform, last-seen/backup timestamps, and backup schedule metadata. |
| Storage bucket `product-images` | Uploads local product photos and creates signed URLs to download/copy cloud photos to the device. |

### RPCs called

| RPC | Purpose / observed inputs |
|---|---|
| `create_shop` | Creates or associates a cloud shop using local shop name, phone, address, owner name, and local shop ID. The client expects a result containing `id`. |
| `upsert_product` | Pushes one product with cloud shop ID, serialized product data, and an expected version. The client expects a result with `status`, `product`, and, for version conflicts, `server`. |
| `complete_sale` | Pushes an idempotency/request ID, product/quantity/unit-price items, discount, tax, payment method, and amount received. The client expects sale/invoice data or a conflict result. |
| `save_backup_snapshot` | Uploads a full snapshot payload (schema version, shop, up to 1,000 local sales with payment history and customer phone numbers, active local products, pending outbox, local settings, timestamp) and expects a backup ID. Local customer-photo files are excluded. |

Product image uploads use `product-images/{cloudShopId}/{productId}/{filename}`. Download URLs are signed for a short duration, then the image is copied into local app storage.

### Sync sequence

1. Check Supabase configuration, network, local shop, and signed-in session.
2. Resolve a cloud shop from `shop_members`, or call `create_shop`.
3. Push pending outbox entries in creation order:
   - Products call `upsert_product`; version/constraint conflicts are recorded locally.
   - Sales call `complete_sale`; stock/payment conflicts are recorded locally.
4. Pull active cloud products, active barcodes, and recent sales into SQLite.
5. Upload a backup snapshot and upsert `sync_devices`.
6. Store last-sync/backup timestamps and refresh provider state.

Sync is attempted after a signed-in app opens, when the network becomes usable, and when the app returns to the foreground. A background task is registered as best-effort; the operating system can defer or restrict when it runs. The local backup schedule is not a guarantee of exact execution time.

## 6. Gaps and recommended fixes

These are findings from the mobile source. Items that require backend schema or deployed-project access are marked **backend verification required** rather than assumed broken.

### P1 — Correctness and data integrity

1. **Cloud product archives are not reconciled on other devices.** Pulling only selects active cloud products. A device that already has a product locally receives no tombstone/inactive update when another device archives it, so it can continue showing and selling that stale local product. Sync deleted/inactive product versions or tombstones and apply them to every device.
2. **Sale and report totals silently operate on a partial sales window.** `readSales()` loads at most 100 records; Home, Sales, Customers, and Reports consume that list. Reports labels totals as business-wide while only using those loaded records. Provide paginated/date-bounded queries and make report scope explicit; test beyond 100 sales.
3. **Product conflicts without a server payload have no usable resolution.** Duplicate/constraint failures can create a product conflict without `server_payload`. Settings then renders the generic sale-review hint, but the provider only resolves product conflicts. Provide an actionable duplicate/conflict path and distinct sale vs. product messaging.
4. **Expenses and staff remain lightweight local lists.** Persistence/load failures are surfaced and UI state updates only after successful writes, but the JSON setting storage has no edit/delete/category workflows and is not synced or backed up separately.
5. **Customer identity is only a free-text sale label.** Checkout allows an optional name which is stored locally on the sale. There is no customer entity or selection/create flow; customer summaries group by name, and names are not sent through the current sale RPC.

### P2 — Missing core workflows / incomplete feature coverage

1. **“Backup & Restore” currently has no full restore flow.** The app uploads snapshots and pulls product/sale tables, but it does not present a snapshot browser/restore action or restore the shop profile, local settings, expenses, or staff from a snapshot. Define and implement a tested recovery workflow (including a new-device scenario), or label the feature backup-only.
2. **Inventory has no existing-stock adjustment/receiving workflow.** Opening stock is entered only on product creation; the existing-product stock field is read-only. Add stock receiving/adjustment records with audit metadata rather than editing stock without history.
3. **Staff is a local directory, not staff management.** There are no staff identities, login, roles/permissions, deactivation, or activity attribution. Either implement those workflows and secure them server-side or describe this screen as a local staff list.
4. **Expenses are isolated from reports and sync semantics.** They are stored as a JSON setting, have no edit/delete/category/date filters, and are omitted from profit calculations. Use a typed expense model, include it in backup/restore, and calculate net profit only when the intended accounting semantics are defined.
5. **Reports have no period selection or export.** Current metrics use loaded local history, not a specified reporting period. Add explicit date ranges and export/share only after paginated data and totals are correct.
6. **Shop profile is not editable after creation.** The local shop is insert-only in the current workflow. Add validated profile editing and define how edits sync to the cloud.
7. **Payment method selection is not payment processing.** eSewa/Khalti/bank transfer are recorded labels only, as indicated in checkout. Do not present them as verified payments until provider integration and reconciliation exist.

### P3 — UX, robustness, and maintainability

1. **The cart is volatile.** It exists only in provider React state and is lost if the process is killed before checkout completes. Persist a draft cart if interrupted-sale recovery is a requirement.
2. **Currency/locale formatting is inconsistent with shop currency.** The profile stores NPR and screens prefix `Rs`, but number formatting uses `en-IN`. Use a shared formatter driven by shop currency and locale.
3. **Operational list limits are fixed.** Cloud pulls cap products at 1,000 and sales at 250; there is no pagination or surfaced “more records available” state. Add pagination and ensure local indexes/queries support large inventories.
4. **Backup schedule is best effort, not a punctual scheduler.** Background execution is OS-controlled and sync requires a signed-in account/network. Keep this limitation clear in UI and make missed/failed backup state prominent.
5. **No shop selection for multi-shop accounts.** Sync deliberately errors if an account has more than one membership. Add an explicit shop picker and persist its choice if multi-shop use is supported.
6. **Customer and product aggregates use display text keys.** Customer grouping uses name; report top-products grouping uses `name_snapshot`. Distinct people/products with the same name can be merged. Aggregate by stable IDs and retain a display label.

### Backend checks outside this repository

No Supabase migration/schema or policy definitions were found among the mobile app files reviewed. Before relying on cloud sync in production, verify:

- The four RPC signatures and return shapes match the mobile client’s expectations.
- `complete_sale` accepts partial initial payments. Follow-up payment entries are currently local and included in backup snapshots; they are not propagated as updates to the hosted `sales` table.
- The current `complete_sale` RPC does not receive customer phone numbers; those are only present in the backup snapshot.
- The backup snapshot may contain customer phone numbers; local face-photo files are not uploaded or restored from snapshots.
- RPCs are transactional and enforce shop membership and role authorization server-side.
- Row-level security protects every queried/updated table and storage object by shop membership.
- `complete_sale` is idempotent by request ID and enforces stock, amount, and discount constraints.
- Product version conflicts and product-archive propagation are handled consistently.
- Snapshot size/retention limits, restore semantics, and sensitive fields are documented.
- `product-images` policies scope reads/writes to authorized shop members.

These are required verification items; the mobile source alone cannot establish whether the deployed Supabase project meets them.

## 7. Suggested order of work

1. Fix and test cross-device product archive reconciliation and product conflict resolution.
2. Make sale/history/report queries paginated and scope every report period explicitly.
3. Implement and test a real restore path, including shop setup on a second device.
4. Add customer records, inventory adjustments, and typed/synced expense and staff workflows—or narrow those labels to their current lightweight behavior.
5. Add surfaced persistence errors and regression tests around offline sale, sync replay/idempotency, conflicts, and larger datasets.
6. Verify backend RPC/RLS/storage policies against the deployed Supabase project.

## 8. Source map

- Root navigation: `app/_layout.jsx`
- Tabs: `app/(tabs)/_layout.jsx`
- Shared state and actions: `src/StoreProvider.jsx`
- SQLite schema and local transaction operations: `src/lib/database.js`
- Cloud sync and conflict handling: `src/lib/sync.js`
- Background backup: `src/lib/backgroundSync.js`
- Supabase configuration/auth storage: `src/lib/supabase.js`
- Product photo persistence/cache: `src/lib/productImages.js`
- Shared screen components: `src/components/Screen.jsx`
- App configuration and native plugins: `app.json`
- Expo/dependency versions and commands: `package.json`
