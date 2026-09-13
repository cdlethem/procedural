import { createStudySketch } from "../study-controls.js";
import { drawDistanceHalos, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "distance-halos", title: "Distance halos", ...materialsASettings["distance-halos"], draw: drawDistanceHalos });
