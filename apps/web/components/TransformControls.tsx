"use client";

import type { Layer } from "@/lib/studio-types";

export function TransformControls({
  layer,
  onChange,
}: {
  layer: Layer;
  onChange: (change: Partial<Layer>) => void;
}) {
  const transform = layer.transform;
  const set = (key: keyof typeof transform, value: number) =>
    onChange({ transform: { ...transform, [key]: value } });
  const field = (
    key: keyof typeof transform,
    label: string,
    min: number,
    max: number,
    step: number,
    display = (value: number) => value,
  ) => {
    const shownMin = display(min);
    const shownMax = display(max);
    const shownStep = display(step);
    return (
      <div className="control" key={key}>
        <label htmlFor={`${layer.id}-transform-${key}`}>
          {label} <output>{display(transform[key])}</output>
        </label>
        <div className="range-number">
          <input
            id={`${layer.id}-transform-${key}`}
            type="range"
            min={min}
            max={max}
            step={step}
            value={transform[key]}
            onChange={(event) => set(key, Number(event.target.value))}
          />
          <input
            aria-label={`Exact ${label}`}
            type="number"
            min={shownMin}
            max={shownMax}
            step={shownStep}
            value={display(transform[key])}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (
                Number.isFinite(value) &&
                value >= shownMin &&
                value <= shownMax
              )
                set(key, key === "scale" ? value / 100 : value);
            }}
          />
        </div>
      </div>
    );
  };
  return (
    <section className="transform-controls">
      <h2>Placement</h2>
      <p className="control-description">
        Position uses the 640 px canvas: X 320 and Y 320 center the layer.
        Rotation is clockwise; scale is a percent.
      </p>
      {field("x", "Position X", -640, 1280, 1)}
      {field("y", "Position Y", -640, 1280, 1)}
      {field("scale", "Scale %", 0.05, 4, 0.01, (value) =>
        Math.round(value * 100),
      )}
      {field("rotation", "Rotation °", -180, 180, 1)}
      <button
        className="action secondary"
        type="button"
        onClick={() =>
          onChange({ transform: { x: 320, y: 320, scale: 1, rotation: 0 } })
        }
      >
        Reset placement
      </button>
    </section>
  );
}
