import { createStudySketch } from "../study-controls.js";
import { drawNearestFeatureMosaic, materialsASettings } from "../materials-a-studies.js";
createStudySketch({ slug: "nearest-feature-mosaic", title: "Nearest feature mosaic", ...materialsASettings["nearest-feature-mosaic"], draw: drawNearestFeatureMosaic });
