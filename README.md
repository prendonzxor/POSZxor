# POSZxor Payment Signup Flow

This document explains the current `Metodo de pago` and `Crear cuenta` implementation so the same pattern can be reused in another project.

## Current Flow

1. The user selects a subscription plan in `Frontend/app/(auth)/signup/page.tsx`.
2. If the plan has a price greater than `0`, the page opens the `Metodo de pago` step.
3. `Frontend/app/components/mercado-pago-checkout-form.tsx` mounts Mercado Pago `CardForm`.
4. Mercado Pago.js calls `https://api.mercadopago.com/v1/card_tokens` from the browser and returns a temporary card token.
5. The token is stored in React state as `paymentTokenData`; no charge is made at this step.
6. When the user clicks `Crear cuenta`, the frontend first validates account fields.
7. For paid plans, the frontend calls `POST /api/process_payment` with the token and amount.
8. The backend creates a Mercado Pago payment through `/v1/payments`.
9. If Mercado Pago returns `approved`, the frontend calls `POST /api/auth/signup`.
10. Signup creates the tenant, owner user, and subscription with the selected plan/payment metadata.

## Files To Copy

- Frontend layout SDK loader: `Frontend/app/layout.tsx`
- Frontend signup page: `Frontend/app/(auth)/signup/page.tsx`
- Frontend card form component: `Frontend/app/components/mercado-pago-checkout-form.tsx`
- Frontend signup API client: `Frontend/api-implementations/signup.ts`
- Backend payment route: `Backend/routes/process-payment.js`
- Backend signup route: `Backend/routes/auth.js`
- Backend Mercado Pago provider: `Backend/services/providers/mercado-pago.service.js`
- Backend payment status messages: `Backend/services/payment-status-message.service.js`
- Backend payment/card-token logs: `Backend/services/payment-log.service.js`, `Backend/services/card-token.service.js`

## Environment Variables 123

Frontend:

```bash
NEXT_PUBLIC_API_BASE_URL="http://localhost:3010"
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY="TEST-your-public-key"
```

Backend:

```bash
MERCADO_PAGO_ACCESS_TOKEN="TEST-your-access-token"
MERCADO_PAGO_API_BASE_URL="https://api.mercadopago.com"
```

Use the public key only in the frontend. Use the access token only in the backend.

## Frontend Setup

Load Mercado Pago.js once in the root layout and expose the initialized SDK as `window.mp`:

```tsx
<Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" />
<Script id="mercado-pago-init" strategy="afterInteractive">
  {`
    (function () {
      const publicKey = ${JSON.stringify(process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "")};
      function initMercadoPago() {
        if (!publicKey || typeof window.MercadoPago !== "function") return false;
        window.mp = new window.MercadoPago(publicKey);
        return true;
      }
      if (initMercadoPago()) return;
      const intervalId = window.setInterval(function () {
        if (initMercadoPago()) window.clearInterval(intervalId);
      }, 100);
      window.setTimeout(function () { window.clearInterval(intervalId); }, 10000);
    })();
  `}
</Script>
```

Mount `CardForm` with the required fields:

```ts
const cardForm = window.mp.cardForm({
  amount: String(amount),
  iframe: true,
  form: {
    id: "form-checkout",
    cardNumber: { id: "form-checkout__cardNumber", placeholder: "Numero de tarjeta" },
    expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/YY" },
    securityCode: { id: "form-checkout__securityCode", placeholder: "Codigo de seguridad" },
    cardholderName: { id: "form-checkout__cardholderName", placeholder: "Titular de la tarjeta" },
    issuer: { id: "form-checkout__issuer", placeholder: "Banco emisor" },
    installments: { id: "form-checkout__installments", placeholder: "Cuotas" },
    cardholderEmail: { id: "form-checkout__cardholderEmail", placeholder: "E-mail" },
  },
  customization: {
    paymentMethods: {
      minInstallments: 1,
      maxInstallments: 1,
    },
  },
  callbacks: {
    onSubmit: (event) => {
      event.preventDefault();
      const data = cardForm.getCardFormData();
      // Save data.token, data.paymentMethodId, data.issuerId, and amount in React state.
    },
  },
});
```

Important: tokenization is not the charge. It only returns the temporary token needed by the backend payment call.

## Payment Request

When the user clicks `Crear cuenta`, call the payment service before creating the account:

```ts
await fetch(`${API_BASE_URL}/api/process_payment`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    transaction_amount: checkoutData.transactionAmount,
    token: checkoutData.token,
    description: checkoutData.description,
    installments: 1,
    payment_method_id: checkoutData.paymentMethodId,
    issuer_id: Number(checkoutData.issuer || 0) || undefined,
    payer: {
      email: accountEmail,
    },
  }),
});
```

Expected successful response from the current backend:

```json
{
  "code": "approved",
  "message": "Pago aprobado.",
  "detail": "accredited"
}
```

If `code` is not `approved`, send the user back to the payment step and ask for another card.

## Backend Payment Endpoint

`POST /api/process_payment` currently:

- Resolves an optional tenant from `Authorization: Bearer <token>` or `tenantId`.
- Creates a `payments` log row.
- Creates a `card_tokens` row with the Mercado Pago card token and metadata.
- Calls Mercado Pago `/v1/payments` through the SDK.
- Updates logs with provider payment id, status, and detail.
- Returns only `{ code, message, detail }`.

Minimal backend payload to Mercado Pago:

```js
{
  transaction_amount: Number(body.transaction_amount),
  token: body.token,
  description: body.description,
  installments: Number(body.installments || 1),
  payment_method_id: body.payment_method_id,
  issuer_id: body.issuer_id,
  payer: {
    email: body.payer.email,
  },
}
```

Always send `X-Idempotency-Key` from the frontend or generate one in the backend to avoid duplicate charges on retries.

## Account Creation Request

Only call signup after the payment is approved:

```ts
await fetch(`${API_BASE_URL}/api/auth/signup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    fullName,
    phoneNumber,
    email,
    password,
    confirmPassword,
    planCode,
    paymentProvider: "mercado-pago",
    paymentMethodToken: checkoutData.token,
    paymentCustomerRef: String(providerPaymentId || ""),
    paymentMethodBrand: checkoutData.paymentMethodId,
  }),
});
```

The current backend requires `paymentMethodToken` for paid plans and accepts only `mercado-pago` as `paymentProvider`.

## Security Notes

- Never collect raw card data in your own inputs. Use Mercado Pago secure fields/CardForm.
- Never store card number, CVV, or expiration date.
- The Mercado Pago card token is temporary and single-use.
- The current implementation stores the token in `card_tokens` and `tenant_subscriptions.payment_method_token` for traceability. In a new project, prefer storing the provider payment id/customer reference and safe metadata instead of relying on the token for future charges.
- Keep `MERCADO_PAGO_ACCESS_TOKEN` on the backend only.
- Use HTTPS outside local development.

## Reuse Checklist

1. Add Mercado Pago SDK loading in your app root.
2. Create a CardForm component with secure fields.
3. Keep installments forced to `1` if your product does not support financing.
4. Store the tokenized payload in frontend state.
5. Validate account fields before charging.
6. Call `/api/process_payment` with idempotency.
7. If approved, create the user/account/subscription.
8. If rejected or errored, reset the card form and return the user to `Metodo de pago`.
9. Log provider status and payment id for support/audit.
10. Do not save raw card data.
