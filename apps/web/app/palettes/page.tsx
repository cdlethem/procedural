import { PaletteLibrary } from "@/components/PaletteLibrary";
import styles from "@/components/PaletteLibrary.module.css";
export default function PalettesPage() {
  return <main className={styles.page}><p className="eyebrow">Your color collection</p><h1>Palettes</h1><p>Find a color direction, keep it, and carry it into another sketch. Pick colors yourself or describe a palette with a prompt. Saved palettes are shared across this installation.</p><PaletteLibrary /></main>;
}
