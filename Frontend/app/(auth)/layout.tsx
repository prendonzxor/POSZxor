import React from 'react';
import { AuthToastProvider } from "./toast-provider";

export const metadata = {
  title: 'Autenticacion',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-8">
      <AuthToastProvider />
      {/* left panel with illustrative image */}


      {/* right panel for form content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
