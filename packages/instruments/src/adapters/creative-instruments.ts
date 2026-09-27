import type {Layer} from '../types.js';
import type {StudioDefinition} from './types.js';
import {growthInstrumentDefinitions, drawGrowthInstrument, prepareGrowthInstrument} from './growth-instruments.js';
import {regionInstrumentDefinitions, drawRegionInstrument} from './region-instruments.js';
import {fluidInstrumentDefinitions, drawFluidInstrument, prepareFluidInstrument} from './fluid-instrument.js';
import {rasterSourceInstrumentDefinitions, drawRasterSourceInstrument} from './raster-source-instruments.js';
import {featureDistanceInstrumentDefinitions, drawFeatureDistanceInstrument} from './feature-distance-instruments.js';
import {placementPackingInstrumentDefinitions, drawPlacementPackingInstrument} from './placement-packing-instruments.js';
import {pathMaterialInstrumentDefinitions, drawPathMaterialInstrument} from './path-material-instruments.js';
import {graphGrammarInstrumentDefinitions, drawGraphGrammarInstrument} from './graph-grammar-instruments.js';
import {imageSignalInstrumentDefinitions, drawImageSignalInstrument} from './image-signal-instruments.js';
import {attractorGrowthDefinitions, drawAttractorGrowth, prepareAttractorGrowth} from './attractor-growth.js';
import {fractalFieldDefinitions, drawFractalField} from './fractal-field-instruments.js';
import {weaveScreenDefinitions, drawWeaveScreen} from './weave-screen-instruments.js';
import {symbolChordDefinitions, drawSymbolChord} from './symbol-chord-instruments.js';
import {rasterTransformInstrumentDefinitions, drawRasterTransformInstrument} from './raster-transform-instruments.js';
import {basicSourceInstrumentDefinitions, drawBasicSourceInstrument} from './basic-source-instruments.js';
import {regionFacetInstrumentDefinitions, drawRegionFacetInstrument} from './region-facet-instruments.js';
import {harmonicTraceDefinitions, drawHarmonicTraces} from './harmonic-traces.js';
import {phyllotacticWhorlsDefinitions, drawPhyllotacticWhorls} from './phyllotactic-whorls.js';
import {edgeTileDefinitions, drawEdgeTiles} from './edge-tile-instruments.js';
import {vectorTraceInstrumentDefinitions, drawVectorTraceInstrument} from './vector-trace-instruments.js';
import {ruleRowDefinitions, drawRuleRows} from './rule-row-instruments.js';
import {proximityReplayInstrumentDefinitions, drawProximityReplayInstrument} from './proximity-replay-instruments.js';
import {constructedGeometryDefinitions, drawConstructedGeometry} from './constructed-geometry-instruments.js';
import {relaxedCellInstrumentDefinitions, drawRelaxedCellInstrument} from './relaxed-cell-instruments.js';
import {orbitalBeadDefinitions, drawOrbitalBrush} from './external-expansion.js';
import {costPathInstrumentDefinitions, drawCostPathInstrument} from './cost-path-instruments.js';
import {contourReliefDefinitions, drawContourRelief} from './contour-relief.js';
import {contourFieldDefinitions, drawContourField} from './contour-field-instruments.js';
import {rampSpringInstrumentDefinitions, drawRampSpringInstrument} from './ramp-spring-instruments.js';
import {revolvedInstrumentDefinitions, drawRevolvedInstrument} from './revolved-instruments.js';
import {perceptualColorDefinitions, drawPerceptualColor} from './perceptual-color-instruments.js';
import {quantizedStripeDefinitions, drawQuantizedStripeInstrument} from './quantized-stripes-instrument.js';

type Canvas = Parameters<typeof drawGrowthInstrument>[0]
  & Parameters<typeof drawRegionInstrument>[0]
  & Parameters<typeof drawFluidInstrument>[0]
  & Parameters<typeof drawRasterSourceInstrument>[0]
  & Parameters<typeof drawFeatureDistanceInstrument>[0]
  & Parameters<typeof drawPlacementPackingInstrument>[0]
  & Parameters<typeof drawPathMaterialInstrument>[0]
  & Parameters<typeof drawGraphGrammarInstrument>[0]
  & Parameters<typeof drawImageSignalInstrument>[0]
  & Parameters<typeof drawAttractorGrowth>[0]
  & Parameters<typeof drawFractalField>[0]
  & Parameters<typeof drawWeaveScreen>[0]
  & Parameters<typeof drawSymbolChord>[0]
  & Parameters<typeof drawRasterTransformInstrument>[0]
  & Parameters<typeof drawBasicSourceInstrument>[0]
  & Parameters<typeof drawRegionFacetInstrument>[0]
  & Parameters<typeof drawHarmonicTraces>[0]
  & Parameters<typeof drawPhyllotacticWhorls>[0]
  & Parameters<typeof drawEdgeTiles>[0]
  & Parameters<typeof drawVectorTraceInstrument>[0]
  & Parameters<typeof drawRuleRows>[0]
  & Parameters<typeof drawProximityReplayInstrument>[0]
  & Parameters<typeof drawConstructedGeometry>[0]
  & Parameters<typeof drawRelaxedCellInstrument>[0]
  & Parameters<typeof drawOrbitalBrush>[0]
  & Parameters<typeof drawCostPathInstrument>[0]
  & Parameters<typeof drawContourRelief>[0]
  & Parameters<typeof drawContourField>[0]
  & Parameters<typeof drawRampSpringInstrument>[0]
  & Parameters<typeof drawRevolvedInstrument>[0]
  & Parameters<typeof drawPerceptualColor>[0]
  & Parameters<typeof drawQuantizedStripeInstrument>[0];
type Prepare = (layer:Layer, cancelled:()=>boolean)=>Promise<boolean>;
type Family = {definitions:StudioDefinition[]; draw:(p:Canvas,layer:Layer)=>void; prepare?:Prepare};
const families:Family[] = [
  {definitions:growthInstrumentDefinitions, draw:drawGrowthInstrument, prepare:prepareGrowthInstrument},
  {definitions:regionInstrumentDefinitions, draw:drawRegionInstrument},
  {definitions:fluidInstrumentDefinitions, draw:drawFluidInstrument, prepare:prepareFluidInstrument},
  {definitions:rasterSourceInstrumentDefinitions, draw:drawRasterSourceInstrument},
  {definitions:featureDistanceInstrumentDefinitions, draw:drawFeatureDistanceInstrument},
  {definitions:placementPackingInstrumentDefinitions, draw:drawPlacementPackingInstrument},
  {definitions:pathMaterialInstrumentDefinitions, draw:drawPathMaterialInstrument},
  {definitions:graphGrammarInstrumentDefinitions, draw:drawGraphGrammarInstrument},
  {definitions:imageSignalInstrumentDefinitions, draw:drawImageSignalInstrument},
  {definitions:attractorGrowthDefinitions, draw:drawAttractorGrowth, prepare:prepareAttractorGrowth},
  {definitions:fractalFieldDefinitions, draw:drawFractalField},
  {definitions:weaveScreenDefinitions, draw:drawWeaveScreen},
  {definitions:symbolChordDefinitions, draw:drawSymbolChord},
  {definitions:rasterTransformInstrumentDefinitions, draw:drawRasterTransformInstrument},
  {definitions:basicSourceInstrumentDefinitions, draw:drawBasicSourceInstrument},
  {definitions:regionFacetInstrumentDefinitions, draw:drawRegionFacetInstrument},
  {definitions:harmonicTraceDefinitions, draw:drawHarmonicTraces},
  {definitions:phyllotacticWhorlsDefinitions, draw:drawPhyllotacticWhorls},
  {definitions:edgeTileDefinitions, draw:drawEdgeTiles},
  {definitions:vectorTraceInstrumentDefinitions, draw:drawVectorTraceInstrument},
  {definitions:ruleRowDefinitions, draw:drawRuleRows},
  {definitions:proximityReplayInstrumentDefinitions, draw:drawProximityReplayInstrument},
  {definitions:constructedGeometryDefinitions, draw:drawConstructedGeometry},
  {definitions:relaxedCellInstrumentDefinitions, draw:drawRelaxedCellInstrument},
  {definitions:orbitalBeadDefinitions, draw:drawOrbitalBrush},
  {definitions:costPathInstrumentDefinitions, draw:drawCostPathInstrument},
  {definitions:contourReliefDefinitions, draw:drawContourRelief},
  {definitions:contourFieldDefinitions, draw:drawContourField},
  {definitions:rampSpringInstrumentDefinitions, draw:drawRampSpringInstrument},
  {definitions:revolvedInstrumentDefinitions, draw:drawRevolvedInstrument},
  {definitions:perceptualColorDefinitions, draw:drawPerceptualColor},
  {definitions:quantizedStripeDefinitions, draw:drawQuantizedStripeInstrument},
];

/** Each ID has exactly one current construction and renderer. */
// Slider increments are interaction affordances, not integer constraints for new instruments.
export const creativeDefinitions:StudioDefinition[] = families.flatMap(family=>family.definitions.map(item=>({
  ...item,
  parameters:item.parameters.map(parameter=>parameter.type === 'number'
    ? {...parameter,integer:parameter.integer ?? false}
    : parameter),
})));
export const creativeDrawers:Record<string,Family['draw']> = {};
export const creativePreparers:Record<string,Prepare> = {};
for(const family of families) for(const item of family.definitions) {
  if(creativeDrawers[item.id]) throw Error(`Duplicate creative instrument: ${item.id}`);
  creativeDrawers[item.id] = family.draw;
  if(family.prepare) creativePreparers[item.id] = family.prepare;
}
