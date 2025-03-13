import { Inter } from "next/font/google";
import { BookingProvider } from "@/context/BookingContext";
import "@/styles/globals.css";
// import Header from "@/components/Header/Header";
// import Footer from "@/components/Footer/Footer";

// Load the Inter font
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function App({ Component, pageProps }) {
  return (
    <BookingProvider>
      <main className={`${inter.variable} font-inter`}>
        {/* <Header /> */}
        <Component {...pageProps} />
        {/* <Footer /> */}
      </main>
    </BookingProvider>
  );
}
