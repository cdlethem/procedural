import { SavedLayerView } from "@/components/SavedLayerView";
export default async function SavedLayerPage({ params }: { params: Promise<{ id: string }> }) {
  return <SavedLayerView id={(await params).id} />;
}
