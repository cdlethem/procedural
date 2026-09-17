import { createMeshStudySketch } from "../mesh-study-controls.js";
import { drawTransportedRibbons, materialsBSettings } from "../materials-b-studies.js";
createMeshStudySketch({slug:"transported-ribbons",title:"Transported ribbons",...materialsBSettings["transported-ribbons"],draw:drawTransportedRibbons});
