import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ApiAuthGuard } from "./api-auth-guard";
import "./globals.css";

const mercadoPagoPublicKey = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "POS Zxor",
  description: "Aplicacion POS Zxor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="light" data-theme="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ApiAuthGuard />
        {children}
        <Script
          src="https://sdk.mercadopago.com/js/v2"
          strategy="afterInteractive"
        />
        <Script id="mercado-pago-security" strategy="afterInteractive">
          {`
            (function () {
              if (document.querySelector('script[data-pos-zxor-mp-security="true"]')) {
                return;
              }

              var script = document.createElement("script");
              script.src = "https://www.mercadopago.com/v2/security.js";
              script.setAttribute("view", "checkout");
              script.setAttribute("data-pos-zxor-mp-security", "true");
              document.body.appendChild(script);
            })();
          `}
        </Script>
        <Script id="mercado-pago-init" strategy="afterInteractive">
          {`
            (function () {
              const publicKey = ${JSON.stringify(mercadoPagoPublicKey)};

              function initMercadoPago() {
                if (!publicKey || typeof window.MercadoPago !== "function") {
                  return false;
                }

                window.mp = new window.MercadoPago(publicKey);
                return true;
              }

              if (initMercadoPago()) {
                return;
              }

              const intervalId = window.setInterval(function () {
                if (initMercadoPago()) {
                  window.clearInterval(intervalId);
                }
              }, 100);

              window.setTimeout(function () {
                window.clearInterval(intervalId);
              }, 10000);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
