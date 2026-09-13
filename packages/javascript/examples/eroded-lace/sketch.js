import { createStudySketch } from "../study-controls.js";
import { drawErodedLace, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "eroded-lace", title: "Eroded lace", ...materialsASettings["eroded-lace"], draw: drawErodedLace });
