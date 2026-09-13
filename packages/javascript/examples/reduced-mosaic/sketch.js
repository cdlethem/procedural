import { createStudySketch } from "../study-controls.js";
import { drawReducedMosaic, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "reduced-mosaic", title: "Reduced mosaic", ...materialsASettings["reduced-mosaic"], draw: drawReducedMosaic });
