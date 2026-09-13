import { createStudySketch } from "../study-controls.js";
import { drawTransportedRibbons, materialsBSettings } from "../materials-b-studies.js";
createStudySketch({slug:"transported-ribbons",title:"Transported ribbons",...materialsBSettings["transported-ribbons"],draw:drawTransportedRibbons});
