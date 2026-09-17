import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";

export const metadata: Metadata = {
  title: "art with knobs — Procedurals",
};

export default function Home() {
  return <LandingPage />;
}
