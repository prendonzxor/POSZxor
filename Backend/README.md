# Backend API

This is a simple Node.js and Express based API for the POSZxor project.

## Getting Started

1. Copy `.env.example` to `.env` and configure values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   - Production: `npm start`
   - Development (with nodemon): `npm run dev`

The server listens on the port defined in `.env` or defaults to `3000`.

## Prisma + MySQL (local)

1. Configure `DATABASE_URL` in `.env`, for example:
   ```bash
   DATABASE_URL="mysql://root:root@localhost:3306/poszxor_db"
   ```
2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Create/apply initial schema in your local MySQL:
   ```bash
   npm run prisma:migrate
   ```
4. Optional direct sync (without migration files):
   ```bash
   npm run prisma:push
   ```

## Swagger Documentation

- UI route: `GET /api/docs`
- OpenAPI spec is generated from route annotations in `routes/*.js`

## Endpoints

- `GET /` – welcome message
- `GET /api/status` – returns JSON with current timestamp
- `GET /api/db-status` – checks MySQL connection through Prisma
- `POST /api/auth/signup` – create a new user account (`fullName`, `phoneNumber`, `password`, `confirmPassword`)
- `POST /api/auth/signin` – authenticate a user (`phoneNumber`, `password`)
- `GET /api/auth/me` – get authenticated user data (`Authorization: Bearer <sessionToken>`)
- `POST /api/auth/recovery-password` – generate a password recovery code (`phoneNumber`)
- `POST /api/auth/reset-password` – reset password using `phoneNumber` + `code` + `newPassword` or legacy `token`
- `GET /api/layaways` – list customer set-asides / apartados
- `POST /api/layaways` – create an apartado and reserve stock
- `POST /api/layaways/:id/complete` – complete an apartado and consume reserved stock
- `POST /api/layaways/:id/cancel` – cancel an apartado and release reserved stock
- `GET /api/categories?tenantId=<tenant-id>` – get categories by tenant
- `POST /api/categories` – create category (`tenantId`, `name`)
- `PUT /api/categories/:id` – update category (`tenantId`, `name`)
- `GET /api/roles?tenantId=<tenant-id>` – get roles by tenant
- `POST /api/roles` – create role (`tenantId`, `name`)
- `PUT /api/roles/:id` – update role (`tenantId`, `name`)
