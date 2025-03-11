import { Inter } from "next/font/google";
import { BookingProvider } from "@/context/BookingContext";
import "@/styles/globals.css";

// Load the Inter font
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function App({ Component, pageProps }) {
  return (
    <BookingProvider>
      <main className={`${inter.variable} font-inter`}>
        <Component {...pageProps} />
      </main>
    </BookingProvider>
  );
}
