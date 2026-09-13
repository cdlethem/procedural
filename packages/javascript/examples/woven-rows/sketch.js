import { createStudySketch } from "../study-controls.js";
import { drawWovenRows, systemsASettings } from "../systems-a-studies.js";
createStudySketch({ slug: "woven-rows", title: "Woven rows", ...systemsASettings["woven-rows"], draw: drawWovenRows });
