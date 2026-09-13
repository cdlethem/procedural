import { createStudySketch } from "../study-controls.js";
import { drawPerceptualBands, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "perceptual-bands", title: "Perceptual bands", ...materialsASettings["perceptual-bands"], draw: drawPerceptualBands });
