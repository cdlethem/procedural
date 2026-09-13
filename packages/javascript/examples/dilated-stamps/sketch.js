import { createStudySketch } from "../study-controls.js";
import { drawDilatedStamps, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "dilated-stamps", title: "Dilated stamps", ...materialsASettings["dilated-stamps"], draw: drawDilatedStamps });
