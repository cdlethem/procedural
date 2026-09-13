import { createStudySketch } from "../study-controls.js";
import { drawSignedEdgePrint, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "signed-edge-print", title: "Signed edge print", ...materialsASettings["signed-edge-print"], draw: drawSignedEdgePrint });
