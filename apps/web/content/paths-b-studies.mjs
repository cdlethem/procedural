export const pathsBStudies = [
 ["stitched-contours","Stitched contours","Shapes & space",["assemble-segment-chains-2d"],"drawStitchedContours","Waves",6], ["fragmented-lines","Fragmented lines","Shapes & space",["assemble-segment-chains-2d"],"drawFragmentedLines","Gap rhythm",9],
 ["blue-noise-stipple","Blue-noise stipple","Fields & paths",["poisson-disc-2d"],"drawBlueNoiseStipple","Spacing",11], ["spaced-symbols","Spaced symbols","Fields & paths",["poisson-disc-2d"],"drawSpacedSymbols","Size",17],
 ["relaxed-stones","Relaxed stones","Shapes & space",["lloyd-relaxation-2d","voronoi-cells-2d"],"drawRelaxedStones","Passes",4], ["centroid-trails","Centroid trails","Fields & paths",["lloyd-relaxation-2d"],"drawCentroidTrails","Passes",6],
 ["packed-posters","Packed posters","Shapes & space",["skyline-pack-2d"],"drawPackedPosters","Blocks",38], ["aspect-tiles","Aspect tiles","Shapes & space",["skyline-pack-2d"],"drawAspectTiles","Scale",.65],
 ["obstacle-roads","Obstacle roads","Fields & paths",["cost-grid-paths-2d"],"drawObstacleRoads","Columns",34], ["arrival-contours","Arrival contours","Fields & paths",["cost-grid-paths-2d","marching-squares-2d"],"drawArrivalContours","Rows",40],
].map(([slug,title,category,operations,draw,label,value])=>({slug,title,category,operations,draw,structuralControl:{label,value}}));
