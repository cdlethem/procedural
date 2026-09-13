import { createStudySketch } from "../study-controls.js";
import { drawRoundedPolyhedra, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"rounded-polyhedra",title:"Rounded polyhedra",...materialsBSettings["rounded-polyhedra"],draw:drawRoundedPolyhedra});
