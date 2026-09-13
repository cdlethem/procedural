import { createStudySketch } from "../study-controls.js";
import { drawRippleInterference, systemsBSettings } from "../systems-b-studies.js";
createStudySketch({ slug: "ripple-interference", title: "Ripple interference", ...systemsBSettings["ripple-interference"], draw: drawRippleInterference });
