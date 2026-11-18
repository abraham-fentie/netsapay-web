import type { Metadata } from "next";
import { RefundsScreen } from "@/features/refunds";

export const metadata: Metadata = { title: "Refunds" };

export default function Page() {
  return <RefundsScreen />;
}
