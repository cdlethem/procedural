import { createStudySketch } from "../study-controls.js";
import { drawExtrudedSeals, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"extruded-seals",title:"Extruded seals",...materialsBSettings["extruded-seals"],draw:drawExtrudedSeals});
