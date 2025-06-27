import React, { useContext, useState, useEffect, useMemo } from "react";
import { format, startOfDay, addDays, isToday } from "date-fns";
import { MdLocationOn } from "react-icons/md";
// shadcn/ui components
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import styles from "@/styles/Home.module.css";
import { BookingContext } from "@/context/BookingContext";
import { useRouter } from "next/router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react"; // You're already using this
// Import helper for blocked times and time conversions
import {
  computeBlockedTimesByDate,
  minutesToTimeString,
  timeStringToMinutes,
} from "@/utils/bookingHelpers";

// Import TimeSlider (NEW)
import TimeSlider from "@/components/TimeSlider/TimeSlider";

// Import shadcn/ui Tabs component
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Original components
import BookingPage from "./index-studio";
import ServiceBooking from "@/components/ServiceBooking/ServiceBooking";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState("studio");

  return (
    <div className={styles.wrapper}>
      {/* Tabs Component - Styled to be centered and compact */}
      <div className="flex justify-center mb-6 w-full">
        <Tabs
          defaultValue="studio"
          className="max-w-[1200px] w-full"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList className="grid grid-cols-2 bg-[#f8f8f8] rounded-lg p-1 mx-auto shadow-sm border border-gray-200 w-full sm:w-[60%]">
            <TabsTrigger
              value="studio"
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:bg-gray-100 data-[state=active]:hover:bg-black"
            >
              Studio Booking
            </TabsTrigger>
            <TabsTrigger
              value="service"
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-md text-sm font-medium transition-all duration-200 ease-in-out hover:bg-gray-100 data-[state=active]:hover:bg-black"
            >
              Service Booking
            </TabsTrigger>
          </TabsList>

          {/* Original Studio Booking Tab */}
          <TabsContent value="studio" className="mt-4 w-full">
            <BookingPage />
          </TabsContent>

          {/* New Service Booking Tab */}
          <TabsContent value="service" className="mt-4 w-full">
            <ServiceBooking />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
