import { Suspense } from "react";
import { Studio } from "@/components/Studio";
export default function StudioPage() {
  return (
    <Suspense fallback={<main className="studio">Loading studio…</main>}>
      <Studio />
    </Suspense>
  );
}
