(function () {
  const checkoutInstances = {};

  function formatMercadoPagoError(error) {
    if (Array.isArray(error)) {
      return error
        .map(function (item) {
          if (!item) {
            return "";
          }

          if (typeof item === "string") {
            return item;
          }

          return item.message || item.description || item.detail || item.cause || item.code || "";
        })
        .filter(Boolean)
        .join(" ");
    }

    if (error && Array.isArray(error.cause)) {
      return formatMercadoPagoError(error.cause);
    }

    if (error && typeof error === "object") {
      return error.message || error.description || error.detail || "No se pudo tokenizar la tarjeta.";
    }

    return "No se pudo tokenizar la tarjeta.";
  }

  function showError(element, message) {
    if (!element) {
      return;
    }

    element.textContent = message || "";
    element.hidden = !message;
  }

  function dispatchTokenized(formElement, detail) {
    formElement.dispatchEvent(
      new CustomEvent("mercadopago:tokenized", {
        bubbles: true,
        detail: detail,
      }),
    );
  }

  function selectSingleInstallment(installmentsElement) {
    if (!installmentsElement) {
      return;
    }

    const singleInstallmentOption = Array.from(installmentsElement.options || []).find(function (option) {
      return String(option.value) === "1";
    });

    if (singleInstallmentOption) {
      const shouldReduceOptions =
        installmentsElement.options.length !== 1 || String(installmentsElement.options[0].value) !== "1";
      const shouldChangeValue = String(installmentsElement.value) !== "1";

      if (shouldReduceOptions) {
        const option = singleInstallmentOption.cloneNode(true);
        option.value = "1";
        option.textContent = singleInstallmentOption.textContent || "1 cuota";
        option.selected = true;
        installmentsElement.replaceChildren(option);
      }

      installmentsElement.value = "1";

      if (shouldReduceOptions || shouldChangeValue) {
        installmentsElement.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }

  function createSingleInstallmentWatcher(installmentsElement) {
    if (!installmentsElement || typeof MutationObserver !== "function") {
      return null;
    }

    const observer = new MutationObserver(function () {
      selectSingleInstallment(installmentsElement);
    });

    observer.observe(installmentsElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "selected"],
    });

    selectSingleInstallment(installmentsElement);
    return observer;
  }

  function destroyMercadoPagoCheckoutNative(formId) {
    const instance = checkoutInstances[formId];
    if (!instance) {
      return;
    }

    if (instance.formElement) {
      delete instance.formElement.dataset.mpNativeReady;
    }

    if (instance.cardForm && typeof instance.cardForm.unmount === "function") {
      try {
        instance.cardForm.unmount();
      } catch (error) {
        console.error("error unmounting Mercado Pago cardForm: ", error);
      }
    }

    if (instance.installmentsObserver && typeof instance.installmentsObserver.disconnect === "function") {
      instance.installmentsObserver.disconnect();
    }

    delete checkoutInstances[formId];
  }

  function initMercadoPagoCheckoutNative(config) {
    const checkoutConfig = config || {};
    const mp = window.mp;
    const formId = checkoutConfig.formId || "form-checkout";
    const ids = {
      cardNumber: checkoutConfig.cardNumberId || "form-checkout__cardNumber",
      expirationDate: checkoutConfig.expirationDateId || "form-checkout__expirationDate",
      securityCode: checkoutConfig.securityCodeId || "form-checkout__securityCode",
      cardholderName: checkoutConfig.cardholderNameId || "form-checkout__cardholderName",
      issuer: checkoutConfig.issuerId || "form-checkout__issuer",
      installments: checkoutConfig.installmentsId || "form-checkout__installments",
      cardholderEmail: checkoutConfig.emailId || "form-checkout__cardholderEmail",
      transactionAmount: checkoutConfig.transactionAmountId || "transactionAmount",
      errorMessage: checkoutConfig.errorMessageId || formId + "__errorMessage",
      submit: checkoutConfig.submitId || formId + "__submit",
    };
    const formElement = document.getElementById(formId);
    const transactionAmountElement = document.getElementById(ids.transactionAmount);
    const installmentsElement = document.getElementById(ids.installments);
    const errorMessageElement = document.getElementById(ids.errorMessage);
    const configuredAmount =
      checkoutConfig.amount ||
      (transactionAmountElement && typeof transactionAmountElement.value === "string"
        ? transactionAmountElement.value
        : "0");
    const description = String(checkoutConfig.description || "Pago POS Zxor").trim();

    if (!formElement) {
      return;
    }

    if (!mp || typeof mp.cardForm !== "function") {
      throw new Error("Mercado Pago cardForm no esta listo para inicializar el checkout.");
    }

    if (checkoutInstances[formId]) {
      destroyMercadoPagoCheckoutNative(formId);
    }

    formElement.dataset.mpNativeReady = "initializing";
    const installmentsObserver = createSingleInstallmentWatcher(installmentsElement);

    let isMounted = false;
    const cardForm = mp.cardForm({
      amount: String(configuredAmount || "0"),
      iframe: true,
      form: {
        id: formId,
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
      },
      customization: {
        paymentMethods: {
          minInstallments: 1,
          maxInstallments: 1,
        },
      },
      callbacks: {
        onFormMounted: function (error) {
          if (error) {
            showError(errorMessageElement, formatMercadoPagoError(error));
            console.warn("Form Mounted handling error: ", error);
            return;
          }

          showError(errorMessageElement, "");
          isMounted = true;
          selectSingleInstallment(installmentsElement);
        },
        onSubmit: async function (event) {
          event.preventDefault();
          showError(errorMessageElement, "");
          selectSingleInstallment(installmentsElement);

          try {
            if (!isMounted || formElement.dataset.mpNativeReady !== "true") {
              showError(errorMessageElement, "El formulario de Mercado Pago todavia no esta listo. Intenta de nuevo.");
              return;
            }

            const data = cardForm.getCardFormData();
            const token = data.token || "";
            const paymentMethodId = data.paymentMethodId || "";
            const issuer = data.issuerId || "";
            const installments = "1";
            const payerEmail = data.cardholderEmail || "";
            const amount = Number(data.amount || configuredAmount || 0);

            if (!token) {
              showError(errorMessageElement, "No se pudo tokenizar la tarjeta.");
              return;
            }

            const tokenizedPayload = {
              token: token,
              paymentMethodId: paymentMethodId,
              issuer: issuer,
              installments: installments,
              payerEmail: payerEmail,
              transactionAmount: amount,
              description: description,
            };

            dispatchTokenized(formElement, tokenizedPayload);
          } catch (error) {
            showError(errorMessageElement, formatMercadoPagoError(error));
            console.error("error submitting Mercado Pago cardForm: ", error);
          }
        },
        onFetching: function (resource) {
          console.log("Fetching resource: ", resource);
          const progressBar = document.querySelector(".progress-bar");
          const payButton = document.getElementById(ids.submit);

          if (progressBar) {
            progressBar.removeAttribute("value");
          }
          if (payButton) {
            payButton.setAttribute("disabled", "true");
          }

          return function () {
            if (progressBar) {
              progressBar.setAttribute("value", "0");
            }
            if (payButton) {
              payButton.removeAttribute("disabled");
            }
          };
        },
      },
    });

    formElement.dataset.mpNativeReady = "true";
    checkoutInstances[formId] = {
      formElement: formElement,
      cardForm: cardForm,
      installmentsObserver: installmentsObserver,
    };
  }

  window.initMercadoPagoCheckoutNative = initMercadoPagoCheckoutNative;
  window.destroyMercadoPagoCheckoutNative = destroyMercadoPagoCheckoutNative;
})();
