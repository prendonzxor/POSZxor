"use client";

import { useEffect } from "react";

const AUTH_ROUTES = ["/signin", "/signup", "/recovery", "/reset"];

function isApiRequest(input: RequestInfo | URL) {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    return new URL(rawUrl, window.location.origin).pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function redirectToSignin() {
  const { pathname, search } = window.location;

  localStorage.removeItem("authToken");
  document.cookie = "authToken=; path=/; max-age=0; samesite=lax";

  if (isAuthRoute(pathname)) {
    return;
  }

  const signinUrl = new URL("/signin", window.location.origin);
  signinUrl.searchParams.set("redirect", `${pathname}${search}`);
  window.location.replace(signinUrl.toString());
}

export function ApiAuthGuard() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);

      if (isApiRequest(input) && (response.status === 401 || response.status === 403)) {
        redirectToSignin();
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
