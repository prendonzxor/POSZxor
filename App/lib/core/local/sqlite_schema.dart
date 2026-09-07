class SqliteSchema {
  const SqliteSchema._();

  static const int version = 1;

  static const List<String> createStatements = [
    // Tenants
    '''
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  legal_name TEXT NOT NULL,
  pos_type TEXT NOT NULL DEFAULT 'RETAIL' CHECK (pos_type IN ('FERRETERIA','RESTAURANTE','RETAIL','SERVICIOS')),
  catalog_mode TEXT NOT NULL DEFAULT 'STANDARD' CHECK (catalog_mode IN ('STANDARD','VARIANTS','RECIPES')),
  ui_preset TEXT NOT NULL DEFAULT 'DEFAULT' CHECK (ui_preset IN ('DEFAULT','COMPACT','TOUCH')),
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  commercial_name TEXT,
  rfc TEXT,
  phone TEXT,
  email TEXT,
  country TEXT NOT NULL DEFAULT 'MX',
  timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_rfc ON tenants(rfc);',
    'CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);',

    // Users
    '''
CREATE TABLE IF NOT EXISTS "User" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  fullName TEXT NOT NULL,
  phoneNumber TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE INDEX IF NOT EXISTS idx_users_tenant ON "User"(tenant_id);',

    // Password reset
    '''
CREATE TABLE IF NOT EXISTS PasswordResetToken (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tokenHash TEXT NOT NULL UNIQUE,
  expiresAt TEXT NOT NULL,
  usedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  userId INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES "User"(id) ON DELETE CASCADE
);
''',
    'CREATE INDEX IF NOT EXISTS idx_password_reset_user ON PasswordResetToken(userId);',
    'CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON PasswordResetToken(expiresAt);',

    // Templates and catalogs
    '''
CREATE TABLE IF NOT EXISTS business_type_templates (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  pos_type TEXT NOT NULL DEFAULT 'RETAIL' CHECK (pos_type IN ('FERRETERIA','RESTAURANTE','RETAIL','SERVICIOS')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
''',
    '''
CREATE TABLE IF NOT EXISTS business_type_template_catalogs (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  catalog_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES business_type_templates(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_bt_template_catalog_key ON business_type_template_catalogs(template_id, catalog_key);',
    'CREATE INDEX IF NOT EXISTS idx_bt_template_catalog_enabled ON business_type_template_catalogs(template_id, is_enabled);',
    '''
CREATE TABLE IF NOT EXISTS business_type_template_categories (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  estatus INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES business_type_templates(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_bt_template_category_name ON business_type_template_categories(template_id, name);',
    'CREATE INDEX IF NOT EXISTS idx_bt_template_category_enabled ON business_type_template_categories(template_id, estatus);',

    '''
CREATE TABLE IF NOT EXISTS tenant_catalogs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  catalog_key TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_catalogs_tenant_key ON tenant_catalogs(tenant_id, catalog_key);',
    'CREATE INDEX IF NOT EXISTS idx_tenant_catalogs_tenant_enabled ON tenant_catalogs(tenant_id, is_enabled);',

    '''
CREATE TABLE IF NOT EXISTS tenant_business_type_profiles (
  tenant_id TEXT PRIMARY KEY,
  business_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
''',
    'CREATE INDEX IF NOT EXISTS idx_tenant_business_type ON tenant_business_type_profiles(business_type);',

    // Roles
    '''
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_tenant_name ON roles(tenant_id, name);',
    'CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id);',

    '''
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE RESTRICT,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_user_role ON user_roles(user_id, role_id);',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);',
    'CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);',

    // Master data
    '''
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  estatus INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_tenant_name ON categories(tenant_id, name);',
    'CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);',

    '''
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  category_id TEXT,
  sku TEXT,
  barcode TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pc' CHECK (unit IN ('pc','kg','g','l','ml','box','pack','service')),
  allow_decimal_qty INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_sku ON products(tenant_id, sku);',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_products_tenant_barcode ON products(tenant_id, barcode);',
    'CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);',
    'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);',
    'CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active);',

    '''
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  address_line1 TEXT,
  city TEXT,
  state TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_tenant_name ON branches(tenant_id, name);',
    'CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);',

    '''
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  credit_balance NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);',
    'CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(tenant_id, phone);',

    // Inventory
    '''
CREATE TABLE IF NOT EXISTS inventory (
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty_on_hand NUMERIC NOT NULL DEFAULT 0,
  reorder_level NUMERIC NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, branch_id, product_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',

    '''
CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('purchase','sale','adjustment','return','transfer_in','transfer_out')),
  qty_delta NUMERIC NOT NULL,
  unit_cost NUMERIC,
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES "User"(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
''',
    'CREATE INDEX IF NOT EXISTS idx_mov_tenant_branch_time ON inventory_movements(tenant_id, branch_id, created_at);',
    'CREATE INDEX IF NOT EXISTS idx_mov_product ON inventory_movements(product_id, created_at);',

    // Orders (from backend raw migrations)
    '''
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  num_order TEXT,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  customer_id TEXT,
  order_type TEXT NOT NULL DEFAULT 'pos' CHECK (order_type IN ('pos','delivery','pickup')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash','card','transfer','mixed','credit')),
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('created','paid','cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES "User"(id)
);
''',
    'CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_tenant_num_order ON orders(tenant_id, num_order);',
    'CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at);',
    'CREATE INDEX IF NOT EXISTS idx_orders_tenant_branch ON orders(tenant_id, branch_id);',
    'CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);',

    '''
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  qty NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);
''',
    'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);',
    'CREATE INDEX IF NOT EXISTS idx_order_items_tenant_product ON order_items(tenant_id, product_id);',

    // Subscription table from backend service
    '''
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL DEFAULT 'FREE' CHECK (plan_code IN ('FREE','STARTER','PRO','ENTERPRISE')),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled')),
  trial_ends_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 1,
  payment_provider TEXT,
  payment_customer_ref TEXT,
  payment_method_last4 TEXT,
  limits_users INTEGER NOT NULL DEFAULT 2,
  limits_branches INTEGER NOT NULL DEFAULT 1,
  limits_products INTEGER NOT NULL DEFAULT 250,
  limits_orders_per_month INTEGER NOT NULL DEFAULT 500,
  limits_customers INTEGER NOT NULL DEFAULT 500,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
''',
    'CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_plan_status ON tenant_subscriptions(plan_code, status);',
  ];
}
