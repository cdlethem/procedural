import { createStudySketch } from "../study-controls.js";
import { drawFlowingBrushes, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "flowing-brushes", title: "Flowing brushes", ...pathsASettings["flowing-brushes"], draw: drawFlowingBrushes });
