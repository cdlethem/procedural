import { createStudySketch } from "../study-controls.js";
import { drawEmbossedField, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "embossed-field", title: "Embossed field", ...materialsASettings["embossed-field"], draw: drawEmbossedField });
