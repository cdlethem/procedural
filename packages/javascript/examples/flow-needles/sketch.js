import { createStudySketch } from "../study-controls.js";
import { drawFlowNeedles, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "flow-needles", title: "Flow needles", ...systemsASettings["flow-needles"], draw: drawFlowNeedles });
