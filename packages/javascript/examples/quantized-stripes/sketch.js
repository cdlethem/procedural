import { createStudySketch } from "../study-controls.js";
import { drawQuantizedStripes, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "quantized-stripes", title: "Quantized stripes", ...materialsASettings["quantized-stripes"], draw: drawQuantizedStripes });
