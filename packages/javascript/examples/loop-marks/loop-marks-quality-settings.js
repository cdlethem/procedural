/** Example-private control mirror of the current web Loop Marks definition. */
export const loopMarksQualitySettings = {
  "defaults": {
    "layout": "row",
    "loopCount": 3,
    "columns": 3,
    "spacingX": 200,
    "spacingY": 20,
    "centerX": 320,
    "centerY": 320,
    "radiusX": 78,
    "radiusY": 105,
    "nestedScale": 0.78,
    "knotCount": 8,
    "lobes": 4,
    "lobeDepth": 0.25,
    "phase": 0,
    "subdivisions": 24,
    "treatment": "outline-tiles",
    "tileShape": "diamond",
    "tileSpacing": 28,
    "tileWidth": 8,
    "tileHeight": 14,
    "fanOpacity": 120,
    "tileScale": 1,
    "outlineWeight": 1.5,
    "opacity": 120,
    "fans": false,
    "moved": false,
    "legacy": false
  },
  "controls": [
    {
      "key": "layout",
      "label": "Layout",
      "description": "Arrange loops along a row, in a grid, or concentrically.",
      "type": "select",
      "options": [
        {
          "value": "row",
          "label": "row"
        },
        {
          "value": "grid",
          "label": "grid"
        },
        {
          "value": "nested",
          "label": "nested"
        }
      ]
    },
    {
      "key": "loopCount",
      "label": "Loops",
      "description": "Number of loops in the chosen layout.",
      "type": "number",
      "min": 1,
      "max": 16,
      "step": 1,
      "integer": true
    },
    {
      "key": "columns",
      "label": "Grid columns",
      "description": "Number of columns when Layout is grid.",
      "type": "number",
      "min": 1,
      "max": 8,
      "step": 1,
      "integer": true
    },
    {
      "key": "spacingX",
      "label": "Spacing X",
      "description": "Horizontal step between loop centers.",
      "type": "number",
      "min": 10,
      "max": 500,
      "step": 1
    },
    {
      "key": "spacingY",
      "label": "Spacing Y",
      "description": "Vertical step between loop centers.",
      "type": "number",
      "min": 10,
      "max": 500,
      "step": 1
    },
    {
      "key": "centerX",
      "label": "Center X",
      "description": "Horizontal center of the loop arrangement.",
      "type": "number",
      "min": -320,
      "max": 960,
      "step": 1
    },
    {
      "key": "centerY",
      "label": "Center Y",
      "description": "Vertical center of the loop arrangement.",
      "type": "number",
      "min": -320,
      "max": 960,
      "step": 1
    },
    {
      "key": "radiusX",
      "label": "Radius X",
      "description": "Horizontal radius of each base spline.",
      "type": "number",
      "min": 4,
      "max": 500,
      "step": 1
    },
    {
      "key": "radiusY",
      "label": "Radius Y",
      "description": "Vertical radius of each base spline.",
      "type": "number",
      "min": 4,
      "max": 500,
      "step": 1
    },
    {
      "key": "nestedScale",
      "label": "Nested scale",
      "description": "Scale factor between concentric loops.",
      "type": "number",
      "min": 0.2,
      "max": 1,
      "step": 0.01
    },
    {
      "key": "knotCount",
      "label": "Base knots",
      "description": "Control points in the base closed spline.",
      "type": "number",
      "min": 5,
      "max": 16,
      "step": 1,
      "integer": true
    },
    {
      "key": "lobes",
      "label": "Lobes",
      "description": "Number of radial waves around the sampled contour; zero keeps the base spline.",
      "type": "number",
      "min": 0,
      "max": 12,
      "step": 1,
      "integer": true
    },
    {
      "key": "lobeDepth",
      "label": "Lobe depth",
      "description": "Strength of the radial waves.",
      "type": "number",
      "min": 0,
      "max": 0.8,
      "step": 0.01
    },
    {
      "key": "phase",
      "label": "Lobe phase",
      "description": "Rotates the radial wave pattern in degrees.",
      "type": "number",
      "min": -180,
      "max": 180,
      "step": 1
    },
    {
      "key": "subdivisions",
      "label": "Subdivisions",
      "description": "Samples per base spline span.",
      "type": "number",
      "min": 8,
      "max": 64,
      "step": 1,
      "integer": true
    },
    {
      "key": "treatment",
      "label": "Treatment",
      "description": "Draw outlines, edge tiles, fans, or outlines with tiles.",
      "type": "select",
      "options": [
        {
          "value": "outline",
          "label": "outline"
        },
        {
          "value": "tiles",
          "label": "tiles"
        },
        {
          "value": "fans",
          "label": "fans"
        },
        {
          "value": "outline-tiles",
          "label": "outline-tiles"
        }
      ]
    },
    {
      "key": "tileShape",
      "label": "Tile shape",
      "description": "Bar, diamond, or perpendicular tick along the contour.",
      "type": "select",
      "options": [
        {
          "value": "bar",
          "label": "bar"
        },
        {
          "value": "diamond",
          "label": "diamond"
        },
        {
          "value": "tick",
          "label": "tick"
        }
      ]
    },
    {
      "key": "tileSpacing",
      "label": "Tile spacing",
      "description": "Distance between edge marks along the contour.",
      "type": "number",
      "min": 4,
      "max": 80,
      "step": 1
    },
    {
      "key": "tileWidth",
      "label": "Tile width",
      "description": "Along-contour tile width, or tick stroke width.",
      "type": "number",
      "min": 1,
      "max": 80,
      "step": 1
    },
    {
      "key": "tileHeight",
      "label": "Tile height",
      "description": "Across-contour tile height.",
      "type": "number",
      "min": 1,
      "max": 80,
      "step": 1
    },
    {
      "key": "outlineWeight",
      "label": "Outline weight",
      "description": "Width of the closed contour stroke.",
      "type": "number",
      "min": 0.1,
      "max": 12,
      "step": 0.1
    },
    {
      "key": "fanOpacity",
      "label": "Fan opacity",
      "description": "Opacity of triangle fans.",
      "type": "number",
      "min": 0,
      "max": 255,
      "step": 1
    }
  ]
};
