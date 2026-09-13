import { createStudySketch } from "../study-controls.js";
import { drawBayerWeave, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "bayer-weave", title: "Bayer weave", ...materialsASettings["bayer-weave"], draw: drawBayerWeave });
