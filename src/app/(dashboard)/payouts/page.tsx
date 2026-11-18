import type { Metadata } from "next";
import { Suspense } from "react";
import { PayoutsScreen } from "@/features/payouts";

export const metadata: Metadata = { title: "Payouts" };

export default function Page() {
  return <Suspense><PayoutsScreen /></Suspense>;
}
