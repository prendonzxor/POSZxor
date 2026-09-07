const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

dotenv.config();

const app = express();
const port = process.env.PORT || 3010;

app.set("etag", false);
app.use(cors());
app.use(express.json());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  next();
});

// Routes
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const meRouter = require("./routes/me");
const onboardingRouter = require("./routes/onboarding");
const categoriesRouter = require("./routes/categories");
const rolesRouter = require("./routes/roles");
const usersRouter = require("./routes/users");
const productsRouter = require("./routes/products");
const inventoryRouter = require("./routes/inventory");
const inventoryMovementsRouter = require("./routes/inventory-movements");
const branchesRouter = require("./routes/branches");
const customersRouter = require("./routes/customers");
const analyticsRouter = require("./routes/analytics");
const ordersRouter = require("./routes/orders");
const tenantsRouter = require("./routes/tenants");
const subscriptionPlansRouter = require("./routes/subscription-plans");
const promotionsRouter = require("./routes/promotions");
const notificationsRouter = require("./routes/notifications");
const layawaysRouter = require("./routes/layaways");
const processPaymentRouter = require("./routes/process-payment");
const processOrderRouter = require("./routes/process-order");
app.use('/api', apiRouter);
app.use('/api/auth', authRouter);
app.use("/api/auth", meRouter);
app.use("/api/onboarding", onboardingRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/users", usersRouter);
app.use("/api/products", productsRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/inventory-movements", inventoryMovementsRouter);
app.use("/api/customers", customersRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/tenants", tenantsRouter);
app.use("/api/subscription-plans", subscriptionPlansRouter);
app.use("/api/promotions", promotionsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/layaways", layawaysRouter);
app.use("/api/process_payment", processPaymentRouter);
app.use("/process_payment", processPaymentRouter);
app.use("/api/process_order", processOrderRouter);
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      tryItOutEnabled: true,
      persistAuthorization: true,
      showMutatedRequest: true,
      requestSnippetsEnabled: true,
      requestSnippets: {
        generators: {
          curl_bash: {
            title: "cURL (bash)",
            syntax: "bash",
          },
        },
        languages: ["curl_bash"],
        defaultExpanded: true,
      },
    },
  })
);

app.get('/', (req, res) => {
  res.send('Welcome to the POSZxor Backend API');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
