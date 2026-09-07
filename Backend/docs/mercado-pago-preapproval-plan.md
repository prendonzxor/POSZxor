# Mercado Pago Preapproval Plan

Backend endpoint added for Mercado Pago plan creation:

`POST /api/tenants/subscription/providers/mercado-pago/preapproval-plan`

Required env vars:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `MERCADO_PAGO_BACK_URL` or send `backUrl` in the request

Example request against this backend:

```bash
curl -X POST \
  'http://localhost:3000/api/tenants/subscription/providers/mercado-pago/preapproval-plan' \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Yoga classes",
    "autoRecurring": {
      "frequency": 1,
      "frequencyType": "months",
      "repetitions": 12,
      "billingDay": 10,
      "billingDayProportional": true,
      "freeTrial": {
        "frequency": 1,
        "frequencyType": "months"
      },
      "transactionAmount": 10,
      "currencyId": "ARS"
    },
    "paymentMethodsAllowed": {
      "payment_types": [
        {}
      ],
      "payment_methods": [
        {}
      ]
    },
    "backUrl": "https://www.yoursite.com"
  }'
```

Equivalent direct Mercado Pago request:

```bash
curl -X POST \
  'https://api.mercadopago.com/preapproval_plan' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Yoga classes",
    "auto_recurring": {
      "frequency": 1,
      "frequency_type": "months",
      "repetitions": 12,
      "billing_day": 10,
      "billing_day_proportional": true,
      "free_trial": {
        "frequency": 1,
        "frequency_type": "months"
      },
      "transaction_amount": 10,
      "currency_id": "ARS"
    },
    "payment_methods_allowed": {
      "payment_types": [
        {}
      ],
      "payment_methods": [
        {}
      ]
    },
    "back_url": "https://www.yoursite.com"
  }'
```

SDK-based payment methods lookup added in backend service:

```js
const { MercadoPagoConfig, PaymentMethods } = require("mercadopago");

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN });
const paymentMethods = new PaymentMethods(client);

paymentMethods
  .get()
  .then((result) => console.log(result))
  .catch((error) => console.log(error));
```

Backend endpoint for that SDK call:

`GET /api/tenants/subscription/providers/mercado-pago/payment-methods`

Order creation endpoint added in backend:

`POST /api/tenants/subscription/providers/mercado-pago/orders`

Example against this backend:

```bash
curl -X POST \
  'http://localhost:3000/api/tenants/subscription/providers/mercado-pago/orders' \
  -H 'Content-Type: application/json' \
  -H 'X-Idempotency-Key: SOME_UNIQUE_VALUE' \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN' \
  -d '{
    "type": "online",
    "processing_mode": "automatic",
    "total_amount": "200.00",
    "external_reference": "ext_ref_1234",
    "payer": {
      "email": "customer@example.com"
    },
    "transactions": {
      "payments": [
        {
          "amount": "200.00",
          "payment_method": {
            "id": "master",
            "type": "credit_card",
            "token": "1223123",
            "installments": 1
          }
        }
      ]
    }
  }'
```

Equivalent direct Mercado Pago request:

```bash
curl -X POST \
  'https://api.mercadopago.com/v1/orders' \
  -H 'Content-Type: application/json' \
  -H 'X-Idempotency-Key: SOME_UNIQUE_VALUE' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "type": "online",
    "processing_mode": "automatic",
    "total_amount": "200.00",
    "external_reference": "ext_ref_1234",
    "payer": {
      "email": "customer@example.com"
    },
    "transactions": {
      "payments": [
        {
          "amount": "200.00",
          "payment_method": {
            "id": "master",
            "type": "credit_card",
            "token": "1223123",
            "installments": 1
          }
        }
      ]
    }
  }'
```
