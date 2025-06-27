import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function AdminNav() {
  const router = useRouter();

  return (
    <div className="bg-white border-b mb-6">
      <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-4">
        <h1 className="text-lg font-bold mr-4">Admin</h1>
        <Link href="/Dashboard">
          <span
            className={`px-4 py-2 hover:bg-gray-100 rounded-md cursor-pointer ${
              router.pathname === "/Dashboard" ? "bg-gray-100 font-medium" : ""
            }`}
          >
            Studio Bookings
          </span>
        </Link>
        <Link href="/ServiceDashboard">
          <span
            className={`px-4 py-2 hover:bg-gray-100 rounded-md cursor-pointer ${
              router.pathname === "/ServiceDashboard"
                ? "bg-gray-100 font-medium"
                : ""
            }`}
          >
            Service Bookings
          </span>
        </Link>
      </div>
    </div>
  );
}
