import { createStudySketch } from "../study-controls.js";
import { drawOrderedHalftone, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "ordered-halftone", title: "Ordered halftone", ...materialsASettings["ordered-halftone"], draw: drawOrderedHalftone });
