# Mercado Pago Integration

This frontend uses Mercado Pago `CardForm` to tokenize card data during signup. The frontend does not charge the card directly and must never store raw card data.

## Current Signup Flow

1. The user selects a plan in `app/(auth)/signup/page.tsx`.
2. If the selected plan has a price greater than `0`, the signup page opens the `Metodo de pago` step.
3. `app/components/mercado-pago-checkout-form.tsx` mounts Mercado Pago `CardForm`.
4. Mercado Pago.js calls `https://api.mercadopago.com/v1/card_tokens` from the browser.
5. Mercado Pago returns a temporary `token`.
6. The frontend stores the tokenized payload in React state as `paymentTokenData`.
7. When the user clicks `Crear cuenta`, the frontend validates the account fields first.
8. If the plan requires payment, the frontend calls `POST /api/process_payment`.
9. If the backend returns `code: "approved"`, the frontend calls `POST /api/auth/signup`.
10. If the payment fails, the user is sent back to `Metodo de pago` to re-enter card information.

## Required Environment Variables

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:3010"
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY="TEST-your-public-key"
```

The Mercado Pago public key is safe for the browser. The Mercado Pago access token must stay in the backend only.

## SDK Loader

The SDK is loaded in `app/layout.tsx`:

```tsx
<Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
```

After the script loads, the app initializes:

```ts
window.mp = new window.MercadoPago(publicKey);
```

`MercadoPagoCheckoutForm` waits until `window.mp.cardForm` is available before mounting the form.

## CardForm Fields

The current frontend uses these Mercado Pago fields:

```ts
form: {
  id: ids.form,
  cardNumber: {
    id: ids.cardNumber,
    placeholder: "Numero de tarjeta",
  },
  expirationDate: {
    id: ids.expirationDate,
    placeholder: "MM/YY",
  },
  securityCode: {
    id: ids.securityCode,
    placeholder: "Codigo de seguridad",
  },
  cardholderName: {
    id: ids.cardholderName,
    placeholder: "Titular de la tarjeta",
  },
  issuer: {
    id: ids.issuer,
    placeholder: "Banco emisor",
  },
  installments: {
    id: ids.installments,
    placeholder: "Cuotas",
  },
  cardholderEmail: {
    id: ids.cardholderEmail,
    placeholder: "E-mail",
  },
}
```

Installments are forced to one payment:

```ts
customization: {
  paymentMethods: {
    minInstallments: 1,
    maxInstallments: 1,
  },
}
```

The component also watches the installments select and keeps only option `1` if Mercado Pago returns more options.

## Tokenization

On submit, `CardForm` returns data through:

```ts
const cardFormData = cardForm.getCardFormData();
```

The frontend stores this payload:

```ts
{
  token,
  paymentMethodId,
  issuer,
  installments: "1",
  payerEmail,
  couponCode,
  transactionAmount,
  description,
}
```

Important: the token is not a charge. It is a temporary Mercado Pago card token used by the backend to create a payment.

## Calling The Backend Payment Service

The signup page calls `createSignupMercadoPagoPayment` from `api-implementations/signup.ts`:

```ts
await createSignupMercadoPagoPayment({
  transaction_amount: checkoutData.transactionAmount,
  token: checkoutData.token,
  description: checkoutData.description,
  installments: 1,
  payment_method_id: checkoutData.paymentMethodId,
  issuer_id: Number(checkoutData.issuer || 0) || undefined,
  payer: {
    email,
  },
});
```

The request is sent to:

```txt
POST /api/process_payment
```

Headers:

```ts
{
  "Content-Type": "application/json",
  "X-Idempotency-Key": crypto.randomUUID(),
}
```

Expected backend response:

```json
{
  "code": "approved",
  "message": "Pago aprobado.",
  "detail": "accredited"
}
```

The frontend checks `code`. If it is not `approved`, it resets the payment form and returns the user to `Metodo de pago`.

## Creating The Account

Only after payment approval, the frontend calls signup:

```ts
await signUp({
  fullName,
  phoneNumber,
  email,
  password,
  confirmPassword,
  planCode: selectedPlanCode,
  paymentProvider: "mercado-pago",
  paymentMethodToken: checkoutData.token,
  paymentCustomerRef: approvedPaymentId ? String(approvedPaymentId) : email,
  paymentMethodBrand: checkoutData.paymentMethodId,
});
```

For free plans, no card token is required and signup can run without calling `/api/process_payment`.

## Reusing This In Another Project

1. Add `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`.
2. Load `https://sdk.mercadopago.com/js/v2` in the app root.
3. Initialize `window.mp = new window.MercadoPago(publicKey)`.
4. Copy or recreate `MercadoPagoCheckoutForm`.
5. Use Mercado Pago secure fields for card number, expiration date, and CVV.
6. Store only the tokenized payload in frontend state.
7. Validate account fields before charging.
8. Send the token to your backend payment endpoint.
9. Create the user only after the backend confirms `approved`.
10. On payment error, reset the form and send the user back to the payment step.

## Security Rules

- Do not store card number, CVV, or expiration date.
- Do not send raw card data to your backend.
- Use the Mercado Pago access token only in the backend.
- Always send an idempotency key when creating the payment.
- Treat the card token as temporary and single-use.

-- =========================
-- POS SaaS (Multi-tenant) Schema - MySQL 8+
-- =========================

-- Use utf8mb4 everywhere
-- SET NAMES utf8mb4;

-- -------------------------
-- Tenancy / Accounts
-- -------------------------
CREATE TABLE tenants (
  id                CHAR(36) PRIMARY KEY,
  legal_name        VARCHAR(180) NOT NULL,
  commercial_name   VARCHAR(180) NULL,
  rfc               VARCHAR(13)  NULL,
  phone             VARCHAR(30)  NULL,
  email             VARCHAR(180) NULL,
  country           VARCHAR(2)   NOT NULL DEFAULT 'MX',
  timezone          VARCHAR(64)  NOT NULL DEFAULT 'America/Mexico_City',
  address_line1     VARCHAR(200) NULL,
  address_line2     VARCHAR(200) NULL,
  city              VARCHAR(120) NULL,
  state             VARCHAR(120) NULL,
  postal_code       VARCHAR(15)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,

  UNIQUE KEY uq_tenants_rfc (rfc),
  KEY idx_tenants_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  email             VARCHAR(180) NOT NULL,
  phone             VARCHAR(30)  NULL,
  full_name         VARCHAR(180) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  is_owner          TINYINT(1)   NOT NULL DEFAULT 0,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at     DATETIME(3)  NULL,
  created_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_users_tenant_email (tenant_id, email),
  KEY idx_users_tenant (tenant_id),
  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE roles (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  name              VARCHAR(80) NOT NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_roles_tenant_name (tenant_id, name),
  KEY idx_roles_tenant (tenant_id),
  CONSTRAINT fk_roles_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE user_roles (
  user_id           CHAR(36) NOT NULL,
  role_id           CHAR(36) NOT NULL,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: permissions as strings (feature flags / API guards)
CREATE TABLE role_permissions (
  role_id           CHAR(36) NOT NULL,
  perm_key          VARCHAR(120) NOT NULL,
  PRIMARY KEY (role_id, perm_key),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Subscription / Billing
-- -------------------------
CREATE TABLE plans (
  id                CHAR(36) PRIMARY KEY,
  code              VARCHAR(50) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  monthly_price_mxn DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE subscriptions (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  plan_id           CHAR(36) NOT NULL,
  status            ENUM('trialing','active','past_due','canceled') NOT NULL DEFAULT 'trialing',
  start_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  trial_end_at      DATETIME(3) NULL,
  current_period_end_at DATETIME(3) NULL,
  canceled_at       DATETIME(3) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_subscriptions_tenant (tenant_id),
  KEY idx_subscriptions_status (status),
  CONSTRAINT fk_sub_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Branches / Stores (optional but recommended)
-- -------------------------
CREATE TABLE branches (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  phone             VARCHAR(30) NULL,
  address_line1     VARCHAR(200) NULL,
  city              VARCHAR(120) NULL,
  state             VARCHAR(120) NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_branches_tenant_name (tenant_id, name),
  KEY idx_branches_tenant (tenant_id),
  CONSTRAINT fk_branches_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Catalog (Products)
-- -------------------------
CREATE TABLE categories (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  name              VARCHAR(120) NOT NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_categories_tenant_name (tenant_id, name),
  KEY idx_categories_tenant (tenant_id),
  CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  category_id       CHAR(36) NULL,
  sku               VARCHAR(64)  NULL,
  barcode           VARCHAR(64)  NULL,
  name              VARCHAR(180) NOT NULL,
  unit              ENUM('pc','kg','g','l','ml','box','pack','service') NOT NULL DEFAULT 'pc',
  allow_decimal_qty TINYINT(1) NOT NULL DEFAULT 0, -- for kg/l etc
  cost              DECIMAL(10,2) NOT NULL DEFAULT 0,
  price             DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate          DECIMAL(5,2)  NOT NULL DEFAULT 0, -- e.g. 16.00
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_products_tenant_sku (tenant_id, sku),
  UNIQUE KEY uq_products_tenant_barcode (tenant_id, barcode),
  KEY idx_products_tenant (tenant_id),
  KEY idx_products_category (category_id),
  KEY idx_products_active (tenant_id, is_active),
  CONSTRAINT fk_products_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory by branch (current stock snapshot)
CREATE TABLE inventory (
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  product_id        CHAR(36) NOT NULL,
  qty_on_hand       DECIMAL(12,3) NOT NULL DEFAULT 0,
  reorder_level     DECIMAL(12,3) NOT NULL DEFAULT 0,
  updated_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tenant_id, branch_id, product_id),

  CONSTRAINT fk_inv_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_inv_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_inv_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inventory movements (append-only ledger)
CREATE TABLE inventory_movements (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  product_id        CHAR(36) NOT NULL,
  type              ENUM('purchase','sale','adjustment','return','transfer_in','transfer_out') NOT NULL,
  qty_delta         DECIMAL(12,3) NOT NULL, -- positive or negative
  unit_cost         DECIMAL(10,2) NULL,
  reference_type    VARCHAR(40) NULL, -- e.g. 'sale','purchase'
  reference_id      CHAR(36) NULL,
  note              VARCHAR(255) NULL,
  created_by        CHAR(36) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_mov_tenant_branch_time (tenant_id, branch_id, created_at),
  KEY idx_mov_product (product_id, created_at),
  CONSTRAINT fk_mov_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_mov_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_mov_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_mov_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Customers / Credit (Fiado)
-- -------------------------
CREATE TABLE customers (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  full_name         VARCHAR(180) NOT NULL,
  phone             VARCHAR(30) NULL,
  email             VARCHAR(180) NULL,
  notes             VARCHAR(255) NULL,
  credit_limit      DECIMAL(10,2) NOT NULL DEFAULT 0,
  credit_balance    DECIMAL(10,2) NOT NULL DEFAULT 0, -- denormalized current balance
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_customers_tenant (tenant_id),
  KEY idx_customers_phone (tenant_id, phone),
  CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE customer_ledger (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  customer_id       CHAR(36) NOT NULL,
  type              ENUM('charge','payment','adjustment') NOT NULL,
  amount            DECIMAL(10,2) NOT NULL, -- positive
  reference_type    VARCHAR(40) NULL,       -- e.g. 'sale'
  reference_id      CHAR(36) NULL,
  note              VARCHAR(255) NULL,
  created_by        CHAR(36) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_ledger_customer_time (tenant_id, customer_id, created_at),
  CONSTRAINT fk_ledger_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ledger_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_ledger_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Sales
-- -------------------------
CREATE TABLE sales (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  folio             BIGINT UNSIGNED NOT NULL, -- sequential per tenant+branch recommended
  status            ENUM('draft','paid','voided','refunded') NOT NULL DEFAULT 'paid',
  sold_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  customer_id       CHAR(36) NULL,
  cashier_user_id   CHAR(36) NULL,

  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_total    DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL DEFAULT 0,

  notes             VARCHAR(255) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_sales_folio (tenant_id, branch_id, folio),
  KEY idx_sales_tenant_time (tenant_id, sold_at),
  KEY idx_sales_customer (tenant_id, customer_id, sold_at),
  CONSTRAINT fk_sales_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_sales_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sales_cashier FOREIGN KEY (cashier_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sale_items (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  sale_id           CHAR(36) NOT NULL,
  product_id        CHAR(36) NOT NULL,
  name_snapshot     VARCHAR(180) NOT NULL, -- keep history if product name changes
  unit_snapshot     VARCHAR(20)  NOT NULL,
  qty               DECIMAL(12,3) NOT NULL,
  unit_price        DECIMAL(10,2) NOT NULL,
  discount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_rate          DECIMAL(5,2)  NOT NULL DEFAULT 0,
  line_total        DECIMAL(10,2) NOT NULL,

  KEY idx_sale_items_sale (sale_id),
  KEY idx_sale_items_product (product_id),
  CONSTRAINT fk_si_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_si_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_si_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sale_payments (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  sale_id           CHAR(36) NOT NULL,
  method            ENUM('cash','card','transfer','credit') NOT NULL,
  amount            DECIMAL(10,2) NOT NULL,
  reference         VARCHAR(120) NULL, -- last4, auth code, transfer id, etc
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_sale_payments_sale (sale_id),
  CONSTRAINT fk_sp_sale FOREIGN KEY (sale_id) REFERENCES sales(id),
  CONSTRAINT fk_sp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Cash Register (Daily closing)
-- -------------------------
CREATE TABLE cash_sessions (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  opened_by         CHAR(36) NOT NULL,
  opened_at         DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  opening_cash      DECIMAL(10,2) NOT NULL DEFAULT 0,

  closed_by         CHAR(36) NULL,
  closed_at         DATETIME(3) NULL,
  closing_cash_counted DECIMAL(10,2) NULL,

  notes             VARCHAR(255) NULL,

  KEY idx_cash_sessions_tenant_branch_time (tenant_id, branch_id, opened_at),
  CONSTRAINT fk_cs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_cs_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_cs_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_cs_closed_by FOREIGN KEY (closed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Expenses
-- -------------------------
CREATE TABLE expenses (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  category          VARCHAR(120) NOT NULL, -- e.g. rent, utilities, supplies
  amount            DECIMAL(10,2) NOT NULL,
  expense_date      DATE NOT NULL,
  note              VARCHAR(255) NULL,
  created_by        CHAR(36) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_expenses_tenant_branch_date (tenant_id, branch_id, expense_date),
  CONSTRAINT fk_exp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_exp_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_exp_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------
-- Suppliers & Purchases (optional but useful)
-- -------------------------
CREATE TABLE suppliers (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  name              VARCHAR(180) NOT NULL,
  phone             VARCHAR(30) NULL,
  email             VARCHAR(180) NULL,
  notes             VARCHAR(255) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_suppliers_tenant (tenant_id),
  CONSTRAINT fk_sup_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchases (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  branch_id         CHAR(36) NOT NULL,
  supplier_id       CHAR(36) NULL,
  status            ENUM('draft','received','voided') NOT NULL DEFAULT 'received',
  received_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  subtotal          DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total             DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_by        CHAR(36) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  KEY idx_purchases_tenant_time (tenant_id, received_at),
  CONSTRAINT fk_pur_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_pur_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT fk_pur_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pur_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE purchase_items (
  id                CHAR(36) PRIMARY KEY,
  tenant_id         CHAR(36) NOT NULL,
  purchase_id       CHAR(36) NOT NULL,
  product_id        CHAR(36) NOT NULL,
  qty               DECIMAL(12,3) NOT NULL,
  unit_cost         DECIMAL(10,2) NOT NULL,
  line_total        DECIMAL(10,2) NOT NULL,

  KEY idx_purchase_items_purchase (purchase_id),
  CONSTRAINT fk_pi_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id),
  CONSTRAINT fk_pi_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;







Public Key = APP_USR-8c504c3b-6cd5-43f9-8b27-07001b28819a
Acccess Token = APP_USR-80222933153694-040720-0193c6ae5c7b29d28252f6c163e5d453-3321021615
