import { createStudySketch } from "../study-controls.js";
import { drawOklabOrbits, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "oklab-orbits", title: "OKLab orbits", ...materialsASettings["oklab-orbits"], draw: drawOklabOrbits });
