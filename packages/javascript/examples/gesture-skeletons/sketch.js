import { createStudySketch } from "../study-controls.js";
import { drawGestureSkeletons, pathsASettings } from "../paths-a-studies.js";
createStudySketch({ slug: "gesture-skeletons", title: "Gesture skeletons", ...pathsASettings["gesture-skeletons"], draw: drawGestureSkeletons });
