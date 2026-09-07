"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, Collection, ComboBox, EmptyState, FieldError, Input, Label, ListBox, Spinner, TextField, toast } from "@heroui/react";
import { useAsyncList } from "@react-stately/data";
import { useRouter } from "next/navigation";
import { createCustomer, searchCustomers } from "@/api-implementations/customers";
import { searchProducts } from "@/api-implementations/products";
import { createCheckoutOrder } from "@/api-implementations/orders";
import { getPrimaryBranch } from "@/api-implementations/branches";
import { getInventory } from "@/api-implementations/inventory";

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  wholesalePrice: number;
  qtyOnHand: number;
  qtyReserved: number;
};

const getProductOptionTextValue = (product: ProductOption) =>
  [product.name, product.sku, product.barcode].filter(Boolean).join(" ");

const isNumericProductQuery = (value: string) => /^\d+$/.test(value.trim());

const getAvailableStock = (qtyOnHand: number, qtyReserved = 0) =>
  Math.max(0, Number(qtyOnHand || 0) - Number(qtyReserved || 0));

const hasStock = (product: ProductOption) => getAvailableStock(product.qtyOnHand, product.qtyReserved) > 0;

type CartItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

type PosOrderType = "pos" | "pos_wholesale" | "delivery" | "pickup" | "cotizacion";

type CustomerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  discount: number;
};

export default function CreatePosOrdersPage() {
  const CREATE_CUSTOMER_OPTION_KEY = "__create_customer__";
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [productSearchValue, setProductSearchValue] = useState("");
  const [pendingProductToAdd, setPendingProductToAdd] = useState<ProductOption | null>(null);
  const [orderQuantity, setOrderQuantity] = useState("1");
  const [orderUnitPrice, setOrderUnitPrice] = useState("0.00");
  const [orderType, setOrderType] = useState<PosOrderType>("pos");
  const [paymentType, setPaymentType] = useState<"cash" | "card" | "transfer" | "mixed" | "credit">("cash");
  const [discountAmount, setDiscountAmount] = useState("0.00");
  const [taxAmount, setTaxAmount] = useState("0.00");
  const [branchId, setBranchId] = useState("");
  const [branchName, setBranchName] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [orderFeedback, setOrderFeedback] = useState<string | null>(null);
  const [isCashPaymentModalOpen, setIsCashPaymentModalOpen] = useState(false);
  const [cashAmountToPay, setCashAmountToPay] = useState("");
  const [cashReceivedAmount, setCashReceivedAmount] = useState("");
  const [cashPaymentError, setCashPaymentError] = useState<string | null>(null);
  const [isCreateCustomerSheetOpen, setIsCreateCustomerSheetOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [isSearchingNumericProduct, setIsSearchingNumericProduct] = useState(false);
  const [createCustomerError, setCreateCustomerError] = useState<string | null>(null);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    fullName: "",
    phone: "",
    email: "",
  });
  const cashReceivedInputRef = useRef<HTMLInputElement | null>(null);
  const customerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  const pendingProductToAddRef = useRef<ProductOption | null>(null);

  const focusCustomerSearch = useCallback(() => {
    window.setTimeout(() => {
      const input = customerSearchInputRef.current;
      if (!input) {
        return;
      }

      const viewportWidth = window.innerWidth;
      const scrollBlock: ScrollLogicalPosition =
        viewportWidth < 640 ? "center" : viewportWidth < 1024 ? "nearest" : "start";

      input.scrollIntoView({
        behavior: "smooth",
        block: scrollBlock,
        inline: "nearest",
      });
      input.focus({ preventScroll: true });
    }, 0);
  }, []);

  const focusProductSearch = useCallback(() => {
    window.setTimeout(() => {
      const input = productSearchInputRef.current;
      if (!input) {
        return;
      }

      input.focus({ preventScroll: true });
    }, 0);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(focusCustomerSearch, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [focusCustomerSearch]);

  const handleAuthError = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const isAuthError =
      message.includes("401") ||
      message.includes("token invalido") ||
      message.includes("token de autorizacion requerido") ||
      message.includes("token expirado") ||
      message.includes("autenticacion");

    if (!isAuthError) {
      return false;
    }

    localStorage.removeItem("authToken");
    document.cookie = "authToken=; path=/; max-age=0; samesite=lax";
    router.replace("/signin");
    return true;
  };

  const getProductPriceForOrderType = (selectedProduct: ProductOption) => {
    if (orderType === "pos_wholesale") {
      const wholesalePrice = Number(selectedProduct.wholesalePrice || 0);
      return Number.isFinite(wholesalePrice) && wholesalePrice > 0 ? wholesalePrice : Number(selectedProduct.price || 0);
    }

    return Number(selectedProduct.price || 0);
  };

  const getRemainingAvailableStock = (selectedProduct: ProductOption | null) => {
    if (!selectedProduct) {
      return null;
    }

    const currentCartQuantity = cartItems.find((item) => item.id === selectedProduct.id)?.quantity || 0;
    const availableQuantity = getAvailableStock(selectedProduct.qtyOnHand, selectedProduct.qtyReserved);
    return Math.max(0, availableQuantity - currentCartQuantity);
  };

  const handleOrderQuantityChange = (value: string) => {
    const selectedProduct = pendingProductToAddRef.current || pendingProductToAdd;
    const remainingStock = getRemainingAvailableStock(selectedProduct);

    if (!value) {
      setOrderQuantity(value);
      return;
    }

    const parsedQuantity = Number(value);
    if (!Number.isFinite(parsedQuantity)) {
      return;
    }

    const normalizedQuantity = Math.max(1, Math.trunc(parsedQuantity));
    if (remainingStock !== null) {
      setOrderQuantity(String(Math.min(normalizedQuantity, remainingStock)));
      return;
    }

    setOrderQuantity(String(normalizedQuantity));
  };
  const selectedProductRemainingStock = getRemainingAvailableStock(pendingProductToAdd);

  useEffect(() => {
    if (selectedProductRemainingStock === null || orderQuantity === "") {
      return;
    }

    const parsedQuantity = Number(orderQuantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= selectedProductRemainingStock) {
      return;
    }

    setOrderQuantity(String(selectedProductRemainingStock));
  }, [orderQuantity, selectedProductRemainingStock]);

  const addProductToCart = (selectedProduct: ProductOption) => {
    const nextQuantity = Math.max(1, Number(orderQuantity) || 1);
    const currentCartQuantity = cartItems.find((item) => item.id === selectedProduct.id)?.quantity || 0;
    const availableQuantity = getAvailableStock(selectedProduct.qtyOnHand, selectedProduct.qtyReserved);
    const nextCartQuantity = currentCartQuantity + nextQuantity;

    if (nextCartQuantity > availableQuantity) {
      toast.danger("Stock insuficiente", {
        description: `Disponible para ${selectedProduct.name}: ${availableQuantity}. Ya tienes ${currentCartQuantity} en la orden.`,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    const typedUnitPrice = Number(orderUnitPrice || "0");
    const basePrice = getProductPriceForOrderType(selectedProduct);
    const nextUnitPrice = typedUnitPrice > 0
      ? typedUnitPrice
      : Number.isFinite(basePrice)
        ? basePrice
        : 0;

    setCartItems((previousItems) => {
      const existingIndex = previousItems.findIndex((item) => item.id === selectedProduct.id);
      if (existingIndex === -1) {
        return [
          ...previousItems,
          {
            id: selectedProduct.id,
            name: selectedProduct.name,
            quantity: nextQuantity,
            unitPrice: nextUnitPrice,
          },
        ];
      }

      return previousItems.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              quantity: item.quantity + nextQuantity,
              unitPrice: nextUnitPrice > 0 ? nextUnitPrice : item.unitPrice,
            }
          : item,
      );
    });

    setSelectedProductId(null);
    setPendingProductToAdd(null);
    pendingProductToAddRef.current = null;
    setProductSearchValue("");
    productList.setFilterText("");
    setOrderQuantity("1");
  };

  const addPendingProductToCart = () => {
    const selectedProduct = pendingProductToAddRef.current || pendingProductToAdd;

    if (!selectedProduct) {
      toast.danger("Selecciona un producto", {
        description: "Primero selecciona un producto o servicio del listado.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }
    addProductToCart(selectedProduct);
  };

  const addSelectedOrExactProductToCart = () => {
    const selectedProduct = pendingProductToAddRef.current || pendingProductToAdd;
    if (selectedProduct) {
      addProductToCart(selectedProduct);
      return;
    }

    const query = productSearchValue.trim().toLowerCase();
    const exactMatches = productList.items.filter((product) =>
      [product.name, product.sku, product.barcode].some((value) => String(value || "").trim().toLowerCase() === query),
    );

    if (exactMatches.length === 1) {
      addProductToCart(exactMatches[0]);
      return;
    }

    toast.danger("Selecciona un producto", {
      description: "Elige un resultado del listado antes de agregarlo.",
      actionProps: {
        children: "Cerrar",
        onPress: () => toast.clear(),
        variant: "tertiary",
      },
    });
  };

  const handleProductInputChange = (value: string) => {
    const selectedProduct = pendingProductToAddRef.current;
    const nextFilterText = isNumericProductQuery(value) ? "" : value;

    setProductSearchValue((previousValue) => (previousValue === value ? previousValue : value));

    if (selectedProduct && value === selectedProduct.name) {
      return;
    }

    if (productList.filterText !== nextFilterText) {
      productList.setFilterText(nextFilterText);
    }

    setSelectedProductId((previousId) => (previousId === null ? previousId : null));
    setPendingProductToAdd((previousProduct) => (previousProduct === null ? previousProduct : null));
    pendingProductToAddRef.current = null;
  };

  const searchNumericProductAndAddToCart = async () => {
    const query = productSearchValue.trim();
    if (!isNumericProductQuery(query) || isSearchingNumericProduct) {
      return;
    }

    if (!branchId) {
      toast.danger("Sucursal no disponible", {
        description: "No se pudo validar el stock porque no hay sucursal configurada.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    try {
      setIsSearchingNumericProduct(true);
      const [response, inventoryResponse] = await Promise.all([
        searchProducts({ sku: query, barcode: query, name: query }),
        getInventory(branchId),
      ]);
      const stockByProductId = new Map(
        inventoryResponse.inventory.map((item) => [
          item.productId,
          {
            qtyOnHand: Number(item.qtyOnHand || 0),
            qtyReserved: Number(item.qtyReserved || 0),
          },
        ]),
      );
      const product = response.products.find((item) => item.barcode === query || item.sku === query) || response.products[0];
      const stock = product ? stockByProductId.get(product.id) : null;
      const qtyOnHand = stock?.qtyOnHand || 0;
      const qtyReserved = stock?.qtyReserved || 0;
      const availableStock = getAvailableStock(qtyOnHand, qtyReserved);

      if (!product || availableStock <= 0) {
        toast.danger("Producto no encontrado", {
          description: `No se encontro un producto con stock para "${query}".`,
          actionProps: {
            children: "Cerrar",
            onPress: () => toast.clear(),
            variant: "tertiary",
          },
        });
        return;
      }

      addProductToCart({
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        price: Number(product.price || 0),
        wholesalePrice: Number(product.wholesalePrice || product.price || 0),
        qtyOnHand,
        qtyReserved,
      });
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }
      toast.danger("No se pudo buscar producto", {
        description: error instanceof Error ? error.message : "Intenta nuevamente.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSearchingNumericProduct(false);
    }
  };

  const removeCartItem = (productId: string) => {
    setCartItems((previousItems) => previousItems.filter((item) => item.id !== productId));
  };

  const cartTotal = cartItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  const parsedDiscountPercentageForView = Number(discountAmount || "0");
  const parsedTaxAmountForView = Number(taxAmount || "0");
  const discountAmountCalculatedForView = Number(
    ((cartTotal * (Number.isFinite(parsedDiscountPercentageForView) ? parsedDiscountPercentageForView : 0)) / 100).toFixed(2),
  );
  const totalToPay = Number(
    Math.max(
      0,
      cartTotal - discountAmountCalculatedForView + (Number.isFinite(parsedTaxAmountForView) ? parsedTaxAmountForView : 0),
    ).toFixed(2),
  );
  const isQuoteOrder = orderType === "cotizacion";

  const buildQuoteMessage = () => {
    const lines = [
      "Cotizacion POS Zxor",
      branchName ? `Sucursal: ${branchName}` : null,
      "",
      ...cartItems.flatMap((item, index) => {
        const quantity = Number(item.quantity) || 0;
        const unitPrice = Number(item.unitPrice) || 0;
        const subtotal = quantity * unitPrice;

        return [
          `${index + 1}. ${item.name}`,
          `   Cantidad: ${quantity}`,
          `   Precio: $${unitPrice.toFixed(2)}`,
          `   Subtotal: $${subtotal.toFixed(2)}`,
        ];
      }),
      "",
      `Subtotal: $${cartTotal.toFixed(2)}`,
      `Descuento: $${discountAmountCalculatedForView.toFixed(2)}`,
      `Impuesto: $${(Number(taxAmount || "0") || 0).toFixed(2)}`,
      `Total: $${totalToPay.toFixed(2)}`,
    ].filter((line): line is string => line !== null);

    return lines.join("\n");
  };

  const copyTextToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fall back to a selected textarea for iOS/Safari.
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    try {
      return document.execCommand("copy");
    } finally {
      textArea.remove();
    }
  };

  const copyQuoteForWhatsApp = async () => {
    if (cartItems.length === 0) {
      toast.danger("Cotizacion vacia", {
        description: "Agrega productos antes de copiar la cotizacion.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    try {
      const copied = await copyTextToClipboard(buildQuoteMessage());
      if (!copied) {
        throw new Error("copy failed");
      }
      toast.success("Cotizacion copiada", {
        description: "El mensaje esta listo para pegarlo en WhatsApp.",
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch {
      toast.danger("No se pudo copiar", {
        description: "Copia manualmente la cotizacion o intenta de nuevo.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    }
  };

  const exportQuote = () => {
    if (cartItems.length === 0) {
      toast.danger("Cotizacion vacia", {
        description: "Agrega productos antes de exportar la cotizacion.",
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    const blob = new Blob([buildQuoteMessage()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cotizacion-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const customerList = useAsyncList<CustomerOption>({
    async load({ filterText }) {
      const query = String(filterText || "").trim();
      if (query.length < 2) {
        return { items: [] };
      }

      try {
        const response = await searchCustomers({ name: query, phone: query });
        return {
          items: response.customers.map((customer) => ({
            id: customer.id,
            fullName: customer.fullName,
            phone: customer.phone,
            discount: Number(customer.discount || 0),
          })),
        };
      } catch (error) {
        if (handleAuthError(error)) {
          return { items: [] };
        }
        throw error;
      }
    },
  });

  const productList = useAsyncList<ProductOption>({
    async load({ filterText }) {
      const query = String(filterText || "").trim();
      if (query.length < 2 || !branchId) {
        return { items: [] };
      }

      try {
        const [response, inventoryResponse] = await Promise.all([
          searchProducts({ sku: query, barcode: query, name: query }),
          getInventory(branchId),
        ]);
        const stockByProductId = new Map(
          inventoryResponse.inventory.map((item) => [
            item.productId,
            {
              qtyOnHand: Number(item.qtyOnHand || 0),
              qtyReserved: Number(item.qtyReserved || 0),
            },
          ]),
        );

        return {
          items: response.products
            .map((product) => {
              const stock = stockByProductId.get(product.id);
              return {
                id: product.id,
                name: product.name,
                sku: product.sku,
                barcode: product.barcode,
                price: Number(product.price || 0),
                wholesalePrice: Number(product.wholesalePrice || product.price || 0),
                qtyOnHand: stock?.qtyOnHand || 0,
                qtyReserved: stock?.qtyReserved || 0,
              };
            })
            .filter(hasStock),
        };
      } catch (error) {
        if (handleAuthError(error)) {
          return { items: [] };
        }
        throw error;
      }
    },
  });

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isCashPaymentModalOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      cashReceivedInputRef.current?.focus();
      cashReceivedInputRef.current?.select();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isCashPaymentModalOpen]);

  useEffect(() => {
    let isMounted = true;

    const loadPrimaryBranch = async () => {
      try {
        const response = await getPrimaryBranch();
        if (!isMounted || !response.branch) {
          return;
        }

        setBranchId(response.branch.id);
        setBranchName(response.branch.name);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        if (handleAuthError(error)) {
          return;
        }
        setOrderFeedback(error instanceof Error ? error.message : "No se pudo obtener la sucursal.");
      }
    };

    loadPrimaryBranch();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateOrder = async (options?: { forceCash?: boolean }) => {
    if (isQuoteOrder) {
      await copyQuoteForWhatsApp();
      return;
    }

    const validationErrors: string[] = [];
    const parsedDiscountPercentage = Number(discountAmount || "0");
    const calculatedDiscountAmount = Number(((cartTotal * parsedDiscountPercentage) / 100).toFixed(2));
    const parsedTaxAmount = Number(taxAmount || "0");
    const allowedOrderTypes = new Set(["pos", "pos_wholesale", "delivery", "pickup"]);
    const allowedPaymentTypes = new Set(["cash", "card", "transfer", "mixed", "credit"]);

    if (!branchId) {
      validationErrors.push("No hay sucursal configurada para crear la orden.");
    }

    if (cartItems.length === 0) {
      validationErrors.push("Agrega al menos un producto o servicio al carrito.");
    }

    if (!allowedOrderTypes.has(orderType)) {
      validationErrors.push("Selecciona un tipo de orden valido.");
    }

    if (!allowedPaymentTypes.has(paymentType)) {
      validationErrors.push("Selecciona un metodo de pago valido.");
    }

    if (
      !Number.isFinite(parsedDiscountPercentage) ||
      parsedDiscountPercentage < 0 ||
      parsedDiscountPercentage > 100
    ) {
      validationErrors.push("El descuento (%) debe ser un numero entre 0 y 100.");
    }

    if (!Number.isFinite(parsedTaxAmount) || parsedTaxAmount < 0) {
      validationErrors.push("El impuesto debe ser un numero mayor o igual a 0.");
    }

    const hasInvalidCartItems = cartItems.some((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      return !item.id || quantity <= 0 || !Number.isFinite(quantity) || unitPrice < 0 || !Number.isFinite(unitPrice);
    });

    if (hasInvalidCartItems) {
      validationErrors.push("Hay productos con cantidad/precio invalido. Revisa el carrito.");
    }

    if (validationErrors.length > 0) {
      const message = validationErrors.join(" ");
      setOrderFeedback(message);
      toast.danger("No se pudo crear la orden", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
      return;
    }

    if (paymentType === "cash" && totalToPay > 0 && !options?.forceCash) {
      setCashPaymentError(null);
      setCashAmountToPay(totalToPay.toFixed(2));
      setCashReceivedAmount(totalToPay.toFixed(2));
      setIsCashPaymentModalOpen(true);
      return;
    }

    try {
      setIsSubmittingOrder(true);
      setOrderFeedback(null);

      const checkoutOrderType: "pos" | "delivery" | "pickup" =
        orderType === "pos_wholesale" || orderType === "cotizacion" ? "pos" : orderType;
      const response = await createCheckoutOrder({
        branchId,
        customerId: selectedCustomerId,
        orderType: checkoutOrderType,
        paymentType,
        discountAmount: calculatedDiscountAmount,
        taxAmount: parsedTaxAmount,
        items: cartItems.map((item) => ({
          productId: item.id,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: 0,
          taxAmount: 0,
        })),
      });

      setCartItems([]);
      setSelectedCustomerId(null);
      customerList.setFilterText("");
      setSelectedProductId(null);
      setPendingProductToAdd(null);
      pendingProductToAddRef.current = null;
      setProductSearchValue("");
      productList.setFilterText("");
      setOrderQuantity("1");
      setOrderUnitPrice("0.00");
      setDiscountAmount("0.00");
      setTaxAmount("0.00");
      const successMessage = `Orden creada: ${response.order.numOrder || response.order.id}`;
      setOrderFeedback(successMessage);
      toast.success("Orden creada correctamente", {
        description:
          paymentType === "cash" && options?.forceCash
            ? `${successMessage}. Cambio: $${Math.max(0, Number(cashReceivedAmount || "0") - totalToPay).toFixed(2)}`
            : successMessage,
        actionProps: {
          children: "OK",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : "No se pudo crear la orden.";
      setOrderFeedback(message);
      toast.danger("No se pudo crear la orden", {
        description: message,
        actionProps: {
          children: "Cerrar",
          onPress: () => toast.clear(),
          variant: "tertiary",
        },
      });
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleConfirmCashPayment = async () => {
    const amountToPay = Number(cashAmountToPay || "0");
    const received = Number(cashReceivedAmount || "0");
    if (!Number.isFinite(amountToPay) || amountToPay < 0) {
      setCashPaymentError("El monto a pagar debe ser un numero mayor o igual a 0.");
      return;
    }

    if (!Number.isFinite(received) || received < 0) {
      setCashPaymentError("El monto recibido debe ser un numero valido.");
      return;
    }

    if (received < amountToPay) {
      setCashPaymentError("El monto recibido no puede ser menor al total a pagar.");
      return;
    }

    setCashPaymentError(null);
    setIsCashPaymentModalOpen(false);
    await handleCreateOrder({ forceCash: true });
  };

  const openCreateCustomerSheet = (suggestedName: string) => {
    setCreateCustomerError(null);
    setQuickCustomerForm({
      fullName: suggestedName,
      phone: "",
      email: "",
    });
    setIsCreateCustomerSheetOpen(true);
  };

  const handleCreateCustomerFromSheet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const fullName = quickCustomerForm.fullName.trim();
    if (!fullName) {
      setCreateCustomerError("El nombre del cliente es obligatorio.");
      return;
    }

    try {
      setIsCreatingCustomer(true);
      setCreateCustomerError(null);
      const response = await createCustomer({
        fullName,
        phone: quickCustomerForm.phone.trim() || undefined,
        email: quickCustomerForm.email.trim() || undefined,
        isActive: true,
      });

      setSelectedCustomerId(response.customer.id);
      customerList.setFilterText(response.customer.fullName);
      setIsCreateCustomerSheetOpen(false);
    } catch (error) {
      if (handleAuthError(error)) {
        return;
      }
      setCreateCustomerError(error instanceof Error ? error.message : "No se pudo crear el cliente.");
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const isF2 = event.key === "F2" || event.code === "F2";
      const isF4 = event.key === "F4" || event.code === "F4";
      const isF5 = event.key === "F5" || event.code === "F5";

      if (isF2) {
        event.preventDefault();
        productSearchInputRef.current?.focus();
        return;
      }

      if (isF4) {
        event.preventDefault();
        event.stopPropagation();
        focusCustomerSearch();
        return;
      }

      if (isF5) {
        event.preventDefault();
        if (isCashPaymentModalOpen && !isSubmittingOrder) {
          void handleConfirmCashPayment();
          return;
        }
        if (isQuoteOrder && cartItems.length > 0) {
          void copyQuoteForWhatsApp();
          return;
        }
        if (!isSubmittingOrder && cartItems.length > 0 && branchId) {
          void handleCreateOrder();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [
    branchId,
    cartItems.length,
    handleConfirmCashPayment,
    handleCreateOrder,
    focusCustomerSearch,
    isCashPaymentModalOpen,
    isQuoteOrder,
    isSubmittingOrder,
    copyQuoteForWhatsApp,
  ]);

  return (
    <section
      className={
        isFullscreen
          ? "fixed inset-0 z-[90] space-y-6 overflow-y-auto bg-gray-50 p-4 sm:p-6 md:p-8"
          : "space-y-6"
      }
    >
      {!isFullscreen && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">POS</h1>
            <p className="mt-2 text-sm text-gray-600">
              Crea una nueva transaccion de punto de venta u orden de cliente.
            </p>
            {branchName ? (
              <p className="mt-1 text-xs text-gray-500">Sucursal: {branchName}</p>
            ) : null}
            {orderFeedback ? (
              <p className="mt-2 text-sm text-gray-700">{orderFeedback}</p>
            ) : null}
          </div>
        </div>
      )}

      <div className="space-y-6">
      <Card className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Atajos</h2>
            <p className="text-sm text-gray-600">Acciones rapidas para caja y teclado.</p>
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            <Button
              size="sm"
              onPress={() => productSearchInputRef.current?.focus()}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
            >
              <span className="font-semibold text-gray-900">F2</span> Buscar producto
            </Button>
            <Button
              size="sm"
              onPress={focusCustomerSearch}
              className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200"
            >
              <span className="font-semibold text-gray-900">F4</span> Buscar cliente
            </Button>
            <Button size="sm" className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200">
              <span className="font-semibold text-gray-900">Esc</span> Vaciar carrito
            </Button>
            <Button
              size="sm"
              onPress={() => {
                if (isQuoteOrder) {
                  void copyQuoteForWhatsApp();
                  return;
                }
                void handleCreateOrder();
              }}
              isDisabled={isSubmittingOrder || cartItems.length === 0 || (!isQuoteOrder && !branchId)}
              className="rounded bg-emerald-100 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-200"
            >
              <span className="font-semibold text-emerald-900">F5</span> {isQuoteOrder ? "Copiar cotizacion" : "Crear orden"}
            </Button>
            {!isFullscreen && (
            <Button size="sm" onPress={() => setIsFullscreen(true)} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
              Pantalla completa
            </Button>
            )}
            {isFullscreen && (
            <Button size="sm" onPress={() => setIsFullscreen(false)} className="rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-200">
                Salir pantalla completa
            </Button>
            )}
          </div>
        </div>
        
      </Card>

      <Card
        as="form"
        onSubmit={(event) => {
          event.preventDefault();
          if (isQuoteOrder) {
            void copyQuoteForWhatsApp();
            return;
          }
          void handleCreateOrder();
        }}
        className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
      
        <div className="grid gap-4 md:grid-cols-2">
          <ComboBox
            allowsEmptyCollection
            className="w-full"
            inputValue={customerList.filterText}
            selectedKey={selectedCustomerId ?? undefined}
            onInputChange={(value) => {
              customerList.setFilterText(value);
              setSelectedCustomerId(null);
              setDiscountAmount("0.00");
            }}
            onSelectionChange={(key) => {
              if (!key) {
                setSelectedCustomerId(null);
                setDiscountAmount("0.00");
                return;
              }

              if (String(key) === CREATE_CUSTOMER_OPTION_KEY) {
                openCreateCustomerSheet(customerList.filterText.trim());
                return;
              }

              const selected = customerList.items.find((customer) => customer.id === String(key));
              if (!selected) {
                return;
              }

              setSelectedCustomerId(selected.id);
              customerList.setFilterText(selected.fullName);
              setDiscountAmount(Number(selected.discount || 0).toFixed(2));
            }}
          >
            <Label className="text-sm font-medium text-gray-800">Nombre del cliente</Label>
            <ComboBox.InputGroup>
              <Input
                ref={customerSearchInputRef}
                type="text"
                className="w-full rounded-full border-border/60"
                placeholder="Buscar cliente por nombre o telefono"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                }}
              />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
              <ListBox
                aria-label="Resultados de clientes"
                renderEmptyState={() =>
                  customerList.filterText.trim().length < 2 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Escribe al menos 2 caracteres.</p>
                  ) : (
                    <EmptyState />
                  )
                }
              >
                {customerList.loadingState === "loading" ? (
                  <ListBox.Item id="loading" textValue="Buscando clientes..." isDisabled>
                    <div className="flex items-center gap-2 py-1">
                      <Spinner size="sm" />
                      <span>Buscando clientes...</span>
                    </div>
                  </ListBox.Item>
                ) : null}
                {customerList.loadingState !== "loading" &&
                customerList.filterText.trim().length >= 2 &&
                customerList.items.length === 0 ? (
                  <ListBox.Item id={CREATE_CUSTOMER_OPTION_KEY} textValue={`Crear cliente ${customerList.filterText.trim()}`}>
                    <div className="flex flex-col">
                      <span className="font-medium text-blue-700">+ Crear cliente &quot;{customerList.filterText.trim()}&quot;</span>
                      <span className="text-xs text-gray-500">No existe en resultados</span>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ) : null}
                <Collection items={customerList.items}>
                  {(customer) => (
                    <ListBox.Item id={customer.id} textValue={customer.fullName}>
                      <div className="flex flex-col">
                        <span>{customer.fullName}</span>
                        <span className="text-xs text-gray-500">{customer.phone || "Sin telefono"}</span>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </Collection>
              </ListBox>
            </ComboBox.Popover>
            {selectedCustomerId ? (
              <p className="mt-1 text-xs text-gray-500">Cliente seleccionado: {selectedCustomerId}</p>
            ) : null}
            <FieldError className="text-xs" />
          </ComboBox>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Tipo de orden</Label>
            <select
              className="w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              value={orderType}
              onChange={(event) => setOrderType(event.target.value as PosOrderType)}
            >
              <option value="pos">POS</option>
              <option value="pos_wholesale">POS Mayoreo</option>
              <option value="delivery">Envio</option>
              <option value="pickup">Recogida</option>
              <option value="cotizacion">Cotizacion</option>
            </select>
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ComboBox
            allowsEmptyCollection
            className="w-full"
            inputValue={productSearchValue}
            selectedKey={selectedProductId ?? undefined}
            onInputChange={handleProductInputChange}
            onSelectionChange={(key) => {
              if (!key) {
                setSelectedProductId(null);
                setPendingProductToAdd(null);
                pendingProductToAddRef.current = null;
                return;
              }

              const selected = productList.items.find((product) => product.id === String(key));
              if (!selected) {
                return;
              }

              pendingProductToAddRef.current = selected;
              setSelectedProductId(selected.id);
              setPendingProductToAdd(selected);
              setProductSearchValue(selected.name);
            }}
          >
            <Label className="text-sm font-medium text-gray-800">Producto o servicio</Label>
            <ComboBox.InputGroup>
              <Input
                ref={productSearchInputRef}
                type="text"
                className="w-full rounded-full border-border/60"
                placeholder="Buscar por nombre, SKU o codigo de barras"
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (pendingProductToAdd) {
                    addPendingProductToCart();
                    return;
                  }
                  if (isNumericProductQuery(productSearchValue)) {
                    void searchNumericProductAndAddToCart();
                    return;
                  }
                  window.setTimeout(addSelectedOrExactProductToCart, 0);
                }}
              />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
              <ListBox
                aria-label="Resultados de productos"
                renderEmptyState={() =>
                  productSearchValue.trim().length < 2 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Escribe al menos 2 caracteres.</p>
                  ) : isNumericProductQuery(productSearchValue) ? (
                    <p className="px-3 py-2 text-sm text-gray-500">Presiona Enter para buscar por SKU o codigo.</p>
                  ) : (
                    <EmptyState />
                  )
                }
              >
                {productList.loadingState === "loading" || isSearchingNumericProduct ? (
                  <ListBox.Item id="loading-products" textValue="Buscando productos..." isDisabled>
                    <div className="flex items-center gap-2 py-1">
                      <Spinner size="sm" />
                      <span>Buscando productos...</span>
                    </div>
                  </ListBox.Item>
                ) : null}
                <Collection items={productList.items}>
                  {(product) => (
                    <ListBox.Item id={product.id} textValue={getProductOptionTextValue(product)}>
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        <span className="text-xs text-gray-500">
                          SKU: {product.sku || "-"} | Barcode: {product.barcode || "-"}
                        </span>
                        <span className="text-xs text-gray-500">
                          Precio: ${getProductPriceForOrderType(product).toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-500">
                          Stock disponible: {getAvailableStock(product.qtyOnHand, product.qtyReserved)}
                          {product.qtyReserved > 0 ? ` | Reservado: ${product.qtyReserved}` : ""}
                        </span>
                      </div>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </Collection>
              </ListBox>
            </ComboBox.Popover>
            {selectedProductId ? (
              <p className="mt-1 text-xs text-gray-500">Producto seleccionado: {selectedProductId}</p>
            ) : null}
            <FieldError className="text-xs" />
          </ComboBox>

          <TextField>
            <Label className="text-sm font-medium text-gray-800">Cantidad</Label>
            <Input
              type="number"
              className="w-full rounded-full border-border/60"
              placeholder="1"
              min={selectedProductRemainingStock === 0 ? "0" : "1"}
              max={selectedProductRemainingStock ?? undefined}
              value={orderQuantity}
              onChange={(event) => handleOrderQuantityChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") {
                  return;
                }
                event.preventDefault();
                addPendingProductToCart();
                focusProductSearch();
              }}
            />
            <FieldError className="text-xs" />
          </TextField>
        </div>

        <div className="flex max-h-[520px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Carrito</h2>
            <p className="text-xs text-gray-500">Productos y servicios agregados a la orden.</p>
          </div>
          <div className="overflow-auto">
            {cartItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Agrega un producto o servicio para comenzar la orden.
              </div>
            ) : (
              <div className="space-y-3 p-3 sm:hidden">
                {cartItems.map((item) => {
                  const quantity = Number(item.quantity) || 0;
                  const unitPrice = Number(item.unitPrice) || 0;
                  const subtotal = quantity * unitPrice;

                  return (
                    <div key={item.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-gray-900">{item.name}</p>
                          <p className="mt-1 text-xs text-gray-500">Cantidad: {quantity}</p>
                        </div>
                        <Button
                          size="sm"
                          onPress={() => removeCartItem(item.id)}
                          aria-label={`Quitar ${item.name}`}
                          className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100"
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        </Button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2 text-xs">
                        <div>
                          <p className="text-gray-500">Precio</p>
                          <p className="mt-0.5 font-semibold text-gray-800">${unitPrice.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-500">Subtotal</p>
                          <p className="mt-0.5 font-semibold text-gray-900">${subtotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <table className="hidden min-w-full text-sm sm:table">
              <thead className="bg-white text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100">
                    <td className="max-w-[320px] px-4 py-3 text-gray-800">
                      <span className="line-clamp-2">{item.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      ${(Number(item.unitPrice) || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ${((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        onPress={() => removeCartItem(item.id)}
                        aria-label={`Quitar ${item.name}`}
                        className="rounded bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100"
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">{cartItems.length} producto(s)</p>
            <p className="text-sm font-semibold text-gray-900">Total: ${cartTotal.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Descuento (%)</Label>
            <Input
              type="number"
              className="w-full rounded-full border-border/60"
              placeholder="0"
              step="0.01"
              value={discountAmount}
              onChange={(event) => setDiscountAmount(event.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Monto calculado: ${Number(((cartTotal * Number(discountAmount || "0")) / 100) || 0).toFixed(2)}
            </p>
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Impuesto</Label>
            <Input
              type="number"
              className="w-full rounded-full border-border/60"
              placeholder="0.00"
              step="0.01"
              value={taxAmount}
              onChange={(event) => setTaxAmount(event.target.value)}
            />
            <FieldError className="text-xs" />
          </TextField>
          <TextField>
            <Label className="text-sm font-medium text-gray-800">Metodo de pago</Label>
            <select
              className="w-full rounded-full border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
              value={paymentType}
              onChange={(event) => setPaymentType(event.target.value as "cash" | "card" | "transfer" | "mixed" | "credit")}
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
              <option value="transfer">Transferencia</option>
              <option value="mixed">Mixto</option>
              <option value="credit">Credito</option>
            </select>
            <FieldError className="text-xs" />
          </TextField>
        </div>

        {isQuoteOrder ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onPress={() => {
                void copyQuoteForWhatsApp();
              }}
              isDisabled={cartItems.length === 0}
              className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:w-auto"
            >
              Copiar para WhatsApp
            </Button>
            <Button
              type="button"
              onPress={exportQuote}
              isDisabled={cartItems.length === 0}
              className="inline-flex w-full items-center justify-center rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-200 sm:w-auto"
            >
              Exportar cotizacion
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            onPress={() => {
              void handleCreateOrder();
            }}
            isLoading={isSubmittingOrder}
            isDisabled={isSubmittingOrder || cartItems.length === 0 || !branchId}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 active:translate-y-0 sm:w-auto"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4 transition-transform group-hover:scale-110"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            {isSubmittingOrder ? "Creando orden..." : "Crear orden"}
          </Button>
        )}
        <p className="text-right text-xs text-gray-500">
          {isQuoteOrder ? "Total cotizado" : "Total a pagar"}: ${totalToPay.toFixed(2)}
        </p>
      </Card>
      </div>

      <div
        className={`fixed inset-0 z-[55] bg-black/35 transition-opacity ${
          isCashPaymentModalOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (isSubmittingOrder) return;
          setIsCashPaymentModalOpen(false);
          setCashPaymentError(null);
        }}
      />
      <div
        className={`fixed inset-0 z-[56] flex items-center justify-center p-4 transition-all ${
          isCashPaymentModalOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <Card className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-2xl">
          <h3 className="text-lg font-semibold text-gray-900">Cobro en efectivo</h3>
          <p className="mt-1 text-sm text-gray-600">Ingresa el monto recibido para calcular el cambio.</p>

            <div className="mt-4 grid gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="cash-total-to-pay">Monto a pagar</Label>
              <Input
                id="cash-total-to-pay"
                type="number"
                step="0.01"
                className="w-full rounded-full border-border/60"
                placeholder="0.00"
                value={cashAmountToPay}
                onChange={(event) => setCashAmountToPay(event.target.value)}
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-500">Total a pagar</p>
              <p className="text-lg font-semibold text-gray-900">
                ${Number(cashAmountToPay || "0").toFixed(2)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cash-received">Monto recibido</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={cashReceivedInputRef}
                  id="cash-received"
                  type="number"
                  step="0.01"
                  className="w-full rounded-full border-border/60"
                  placeholder="0.00"
                  value={cashReceivedAmount}
                  onChange={(event) => setCashReceivedAmount(event.target.value)}
                />
                <Button
                  type="button"
                  onPress={() => setCashReceivedAmount("")}
                  className="rounded bg-gray-100 px-3 py-2 text-xs text-gray-700 hover:bg-gray-200"
                >
                  Limpiar
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-700">Cambio</p>
              <p className="text-lg font-semibold text-emerald-800">
                ${Math.max(0, Number(cashReceivedAmount || "0") - Number(cashAmountToPay || "0")).toFixed(2)}
              </p>
            </div>
          </div>

          {cashPaymentError ? <p className="mt-3 text-sm text-red-600">{cashPaymentError}</p> : null}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              onPress={() => {
                setIsCashPaymentModalOpen(false);
                setCashPaymentError(null);
              }}
              isDisabled={isSubmittingOrder}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </Button>
            <Button
              onPress={() => {
                void handleConfirmCashPayment();
              }}
              isLoading={isSubmittingOrder}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Confirmar y crear orden
            </Button>
          </div>
        </Card>
      </div>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          isCreateCustomerSheetOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => {
          if (isCreatingCustomer) return;
          setIsCreateCustomerSheetOpen(false);
        }}
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-2xl transition-transform sm:p-6 ${
          isCreateCustomerSheetOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Nuevo cliente</h2>
          <Button
            onPress={() => setIsCreateCustomerSheetOpen(false)}
            isDisabled={isCreatingCustomer}
            className="rounded bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            Cerrar
          </Button>
        </div>

        <form onSubmit={handleCreateCustomerFromSheet} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-customer-fullname" className="text-sm font-medium text-gray-800">
              Nombre completo *
            </label>
            <input
              id="quick-customer-fullname"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={quickCustomerForm.fullName}
              onChange={(event) => setQuickCustomerForm((prev) => ({ ...prev, fullName: event.target.value }))}
              placeholder="Ej. Juan Perez"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-customer-phone" className="text-sm font-medium text-gray-800">
              Telefono
            </label>
            <input
              id="quick-customer-phone"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={quickCustomerForm.phone}
              onChange={(event) => setQuickCustomerForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="5512345678"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="quick-customer-email" className="text-sm font-medium text-gray-800">
              Correo
            </label>
            <input
              id="quick-customer-email"
              type="email"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              value={quickCustomerForm.email}
              onChange={(event) => setQuickCustomerForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="cliente@correo.com"
            />
          </div>

          {createCustomerError ? (
            <p className="text-sm text-red-600">{createCustomerError}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
            <Button
              type="button"
              onPress={() => setIsCreateCustomerSheetOpen(false)}
              isDisabled={isCreatingCustomer}
              className="rounded bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isCreatingCustomer}
              isDisabled={isCreatingCustomer}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Guardar cliente
            </Button>
          </div>
        </form>
      </aside>
    </section>
  );
}
