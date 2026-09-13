import { createStudySketch } from "../study-controls.js";
import { drawDiffusionEngraving, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "diffusion-engraving", title: "Diffusion engraving", ...materialsASettings["diffusion-engraving"], draw: drawDiffusionEngraving });
