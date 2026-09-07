const swaggerJSDoc = require("swagger-jsdoc");

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "POSZxor Backend API",
    version: "1.0.0",
    description: "API documentation for POSZxor backend services",
  },
  servers: [
    {
      url: "http://localhost:3010",
      description: "Local development server",
    },
  ],
  tags: [
    { name: "System", description: "Health checks and backend status endpoints" },
    { name: "Auth", description: "Authentication and session endpoints" },
    { name: "Onboarding", description: "Tenant onboarding flow endpoints" },
    { name: "Tenants", description: "Tenant profile, subscription and provider integration endpoints" },
    { name: "Categories", description: "Category management endpoints" },
    { name: "Subscription Plans", description: "Pricing and subscription plan catalog endpoints" },
    { name: "Promotions", description: "Coupons and discount rule management endpoints" },
    { name: "Notifications", description: "Tenant notifications and messages endpoints" },
    { name: "Layaways", description: "Customer set-asides and stock reservation endpoints" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "Token",
      },
    },
    schemas: {
      ApiStatusResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      DbStatusResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          database: { type: "string", example: "connected" },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "ok" },
          app: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              checkedAt: { type: "string", format: "date-time" },
              uptimeSeconds: { type: "integer", example: 120 },
            },
          },
          database: {
            type: "object",
            properties: {
              status: { type: "string", example: "connected" },
              name: { type: "string", example: "poszxor" },
              currentDate: { type: "string", format: "date-time" },
            },
          },
        },
      },
      HealthErrorResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "error" },
          app: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              checkedAt: { type: "string", format: "date-time" },
              uptimeSeconds: { type: "integer", example: 120 },
            },
          },
          database: {
            type: "object",
            properties: {
              status: { type: "string", example: "disconnected" },
              name: { type: "string", nullable: true, example: null },
              currentDate: { type: "string", nullable: true, example: null },
              error: {
                type: "string",
                example: "Can't reach database server at `localhost:3306`",
              },
            },
          },
        },
      },
      SignUpRequest: {
        type: "object",
        required: ["fullName", "phoneNumber", "password", "confirmPassword"],
        properties: {
          fullName: { type: "string", example: "Mariana Soto" },
          phoneNumber: { type: "string", example: "5551234567" },
          password: { type: "string", example: "StrongPass123" },
          confirmPassword: { type: "string", example: "StrongPass123" },
          posType: {
            type: "string",
            enum: ["FERRETERIA", "RESTAURANTE", "RETAIL", "SERVICIOS"],
            example: "RETAIL",
          },
          legalName: { type: "string", example: "POS Zxor SA de CV" },
          commercialName: { type: "string", example: "POS Zxor" },
          rfc: { type: "string", example: "XAXX010101000" },
          tenantPhone: { type: "string", example: "5551234567" },
          email: { type: "string", example: "contacto@poszxor.com" },
          country: { type: "string", example: "MX" },
          timezone: { type: "string", example: "America/Mexico_City" },
          addressLine1: { type: "string", example: "Av. Reforma 100" },
          addressLine2: { type: "string", example: "Piso 3" },
          city: { type: "string", example: "CDMX" },
          state: { type: "string", example: "Ciudad de Mexico" },
          postalCode: { type: "string", example: "06000" },
        },
      },
      SignInRequest: {
        type: "object",
        required: ["phoneNumber", "password"],
        properties: {
          phoneNumber: { type: "string", example: "5551234567" },
          password: { type: "string", example: "StrongPass123" },
        },
      },
      RecoveryPasswordRequest: {
        type: "object",
        required: ["phoneNumber"],
        properties: {
          phoneNumber: { type: "string", example: "5551234567" },
        },
      },
      RecoveryPasswordResponse: {
        type: "object",
        properties: {
          message: {
            type: "string",
            example: "Si el phoneNumber existe, se enviara un codigo de recuperacion",
          },
          expiresAt: { type: "string", format: "date-time" },
          recoveryCode: {
            type: "string",
            example: "493821",
            description: "Only returned outside production. In production, send this code by SMS or WhatsApp.",
          },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        required: ["newPassword"],
        properties: {
          phoneNumber: { type: "string", example: "5551234567" },
          code: { type: "string", example: "493821" },
          token: {
            type: "string",
            example: "5a13ff5...",
            description: "Legacy reset token. Use phoneNumber + code for phone recovery.",
          },
          newPassword: { type: "string", example: "MyNewPass123" },
        },
      },
      ResetPasswordResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "contrasena restablecida exitosamente" },
        },
      },
      UserResponse: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          tenantId: { type: "string", example: "f9789760-4dc8-4fb6-9f7d-9c177d2038ef" },
          fullName: { type: "string", example: "Mariana Soto" },
          phoneNumber: { type: "string", example: "5551234567" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string", example: "4aef4f6c-8de4-4ea9-8f73-4f4717a2d112" },
          tenantId: { type: "string", example: "f9789760-4dc8-4fb6-9f7d-9c177d2038ef" },
          name: { type: "string", example: "Bebidas" },
          estatus: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CategoryCreateRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Bebidas" },
          estatus: { type: "boolean", example: true },
        },
      },
      CategoryUpdateRequest: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", example: "Snacks" },
          estatus: { type: "boolean", example: false },
        },
      },
      OnboardingUpdateRequest: {
        type: "object",
        properties: {
          onboardingStep: { type: "integer", minimum: 1, maximum: 10, example: 3 },
          onboardingCompleted: { type: "boolean", example: false },
        },
      },
      OnboardingTemplate: {
        type: "object",
        properties: {
          key: { type: "string", example: "FERRETERIA" },
          label: { type: "string", example: "Ferreteria" },
          posType: { type: "string", example: "FERRETERIA" },
        },
      },
      OnboardingTemplatesResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "plantillas obtenidas" },
          templates: {
            type: "array",
            items: { $ref: "#/components/schemas/OnboardingTemplate" },
          },
        },
      },
      OnboardingDefaultCategoriesResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "categorias por defecto obtenidas" },
          businessType: { type: "string", example: "FERRETERIA" },
          categories: {
            type: "array",
            items: { type: "string" },
            example: ["Tornillos", "Tuercas", "Rondanas"],
          },
        },
      },
      ApplyOnboardingTemplateRequest: {
        type: "object",
        required: ["businessType"],
        properties: {
          businessType: { type: "string", example: "FERRETERIA" },
        },
      },
      ApplyOnboardingTemplateResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "plantilla aplicada" },
          result: {
            type: "object",
            properties: {
              templateKey: { type: "string", example: "FERRETERIA" },
              templateLabel: { type: "string", example: "Ferreteria" },
              catalogsApplied: { type: "integer", example: 7 },
              categoriesApplied: { type: "integer", example: 4 },
            },
          },
        },
      },
      CategorySingleResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "categoria creada" },
          category: { $ref: "#/components/schemas/Category" },
        },
      },
      CategoriesListResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "categorias obtenidas" },
          categories: {
            type: "array",
            items: { $ref: "#/components/schemas/Category" },
          },
        },
      },
      MercadoPagoAutoRecurring: {
        type: "object",
        required: ["frequency", "frequency_type", "transaction_amount", "currency_id"],
        properties: {
          frequency: { type: "integer", example: 1 },
          frequency_type: {
            type: "string",
            enum: ["days", "months"],
            example: "months",
          },
          start_date: {
            type: "string",
            format: "date-time",
            example: "2026-06-10T00:00:00.000Z",
          },
          end_date: {
            type: "string",
            format: "date-time",
            example: "2027-06-10T00:00:00.000Z",
          },
          transaction_amount: { type: "number", example: 199 },
          currency_id: { type: "string", example: "MXN" },
        },
      },
      MercadoPagoPreapprovalRequest: {
        type: "object",
        required: ["reason", "payer_email", "card_token_id", "auto_recurring"],
        properties: {
          preapproval_plan_id: {
            type: "string",
            example: "08ecc78864db4d278ac90ee733f7ae99",
            description: "ID del plan de preapproval creado en Mercado Pago.",
          },
          reason: { type: "string", example: "Suscripcion Zxor POS Basico" },
          external_reference: { type: "string", example: "subscription:BASIC" },
          payer_email: { type: "string", format: "email", example: "cliente@example.com" },
          card_token_id: {
            type: "string",
            example: "e3ed6f098462036dd2cbabe314b9de2a",
            description: "Token temporal generado por MercadoPago.js/CardForm con la public key del mismo app.",
          },
          auto_recurring: { $ref: "#/components/schemas/MercadoPagoAutoRecurring" },
          back_url: {
            type: "string",
            format: "uri",
            example: "https://poszxor.com/subscription-checkout",
          },
          status: {
            type: "string",
            example: "authorized",
            default: "authorized",
          },
        },
      },
      MercadoPagoPreapprovalResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "preapproval creado" },
          provider: { type: "string", example: "mercado-pago" },
          endpoint: { type: "string", example: "/preapproval" },
          request: { $ref: "#/components/schemas/MercadoPagoPreapprovalRequest" },
          preapproval: {
            type: "object",
            additionalProperties: true,
            properties: {
              id: { type: "string", example: "2c938084726fca480172750000000000" },
              status: { type: "string", example: "authorized" },
              reason: { type: "string", example: "Suscripcion Zxor POS Basico" },
              external_reference: { type: "string", example: "subscription:BASIC" },
              preapproval_plan_id: { type: "string", example: "08ecc78864db4d278ac90ee733f7ae99" },
            },
          },
        },
      },
      MercadoPagoProviderErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "Card token service not found" },
          details: {
            type: "object",
            nullable: true,
            additionalProperties: true,
            example: {
              message: "Card token service not found",
              status: 404,
            },
          },
        },
      },
      ErrorResponse: {
        type: "object",
        properties: {
          message: { type: "string", example: "invalid credentials" },
        },
      },
    },
  },
};

const options = {
  definition: swaggerDefinition,
  apis: ["./routes/*.js", "./index.js"],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
