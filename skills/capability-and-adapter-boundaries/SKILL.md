---
name: capability-and-adapter-boundaries
description: Classify and implement host-specific rendering behavior without leaking it into the portable core. Use for renderers, shaders, fonts, images, pixels, assets, platform lifecycle, and third-party libraries.
---

# Capability and adapter boundaries

## Trigger

Use this skill whenever an operation or port touches:

- JAVA2D, P2D, P3D, Canvas2D, WebGL, or OpenGL ES;
- shaders or blend modes;
- fonts, glyph outlines, or text metrics;
- image decoding, sampling, or pixel buffers;
- pixel density, colour modes, or framebuffer behavior;
- asset lookup, storage, asynchronous loading, or context lifecycle;
- toxiclibs, triangulate, or another target-dependent library;
- interaction or target state that cannot be represented as portable input data.

The goal is not identical host machinery. The goal is one declared behavior, explicit
capability requirements, and honest support claims.

## Classify before coding

For every affected behavior, place it in exactly one category:

1. **Portable core:** deterministic computation over JSON-compatible values, arrays,
   records, geometry buffers, or canonical commands.
2. **Target adapter:** translation from canonical values/commands into native host calls.
3. **Required capability:** behavior without which the operation cannot meet its contract.
4. **Named semantic fallback:** deliberately different behavior with its own mode,
   documentation, fixtures, and benchmark evidence.
5. **Unsupported:** explicit stable result for that target/capability combination.

Do not hide category 3 or 5 in adapter implementation details. Record it in the shared
catalog and capability matrix.

## Portable boundary

Core code may consume explicit environment values such as dimensions, density, colour
space, asset descriptors, time, and capability declarations. It must not consume or return
host objects including `PApplet`, `PGraphics`, `PVector`, `PShape`, `PShader`, Canvas/DOM
objects, py5 wrappers, Android views, AWT/Swing classes, or renderer contexts.

Represent portable output as stable geometry or command data. Adapter callbacks are not a
portable data format. Core code must not probe the host renderer or silently select a
fallback.

## Capability declaration

Define capabilities at semantic granularity, not broad target labels. Examples:

- indexed triangle mesh with depth testing;
- programmable fragment shader with required uniforms and texture access;
- glyph metrics for a named embedded font;
- pixel read/write at a declared density and colour encoding;
- blend mode with specified source/destination behavior;
- synchronous availability of a declared image asset.

For each requirement specify:

- capability identifier and version if semantics may evolve;
- operation and parameter combination that requires it;
- targets/adapters that provide it;
- preflight check;
- stable unsupported error/result;
- whether a named fallback exists and how its output intentionally differs.

Do not infer support merely because an API has a similarly named function.

## Adapter responsibilities

A target adapter may:

- translate canonical geometry and draw commands;
- map coordinate, colour, and transform conventions;
- load declared assets according to target rules;
- compile target shader dialects;
- negotiate pixel density and framebuffer formats;
- isolate and restore native renderer state;
- surface lifecycle/context loss and unsupported capabilities.

It must not:

- duplicate generators or transforms from the portable core;
- change defaults or parameter bounds;
- reorder commands for convenience when order is observable;
- substitute fonts, images, shaders, renderers, or blend modes silently;
- read undeclared globals;
- retain native mutable state across calls unless the contract specifies lifecycle;
- catch an unsupported case and return a plausible but semantically different image.

## High-risk surfaces

### Renderers and state

Test transforms, clipping, depth, winding, stroke/fill, colour modes, blend state, and
push/pop equivalence in the native runtime. An adapter must leave external renderer state
as it found it unless the contract explicitly transfers ownership.

### Shaders

Declare shader stage, dialect/version, uniforms, texture/color conventions, precision, and
required renderer. Processing desktop GLSL, browser WebGL, and Android OpenGL ES are not
interchangeable. CPU emulation is a fallback only when named and benchmarked. Xvfb shader
renders are suspect evidence.

### Text and fonts

Use named, distributable assets where reproducibility depends on metrics. Declare glyph
coverage, baseline/origin, alignment, size unit, and whether output uses glyph metrics,
outlines, or raster text. Missing-font substitution is unsupported unless an intentionally
different fallback is documented.

### Images and pixels

Declare decoding/color assumptions, coordinate origin, interpolation, boundary handling,
alpha convention, pixel density, and read/write timing. Browser asynchronous loading and
Android asset packaging remain adapter concerns but must expose readiness/failure rather
than changing the core algorithm.

### Android

The core must remain free of `java.desktop`, AWT/Swing, reflection-based serialization,
desktop filesystem assumptions, and desktop-only concurrency. Adapters must handle
lifecycle/context loss and constrained assets explicitly.

## Verification

Add native adapter integration cases for every claimed capability. Use actual runtimes, not
mock drawing APIs. Assert:

- capability preflight and stable unsupported results;
- renderer-state isolation;
- command order, topology, transforms, colour/style state, and density mapping;
- asset/font/shader success and real failure paths;
- lifecycle reset where applicable;
- named fallback output separately from primary behavior.

Then apply `skills/corpus-reproduction/SKILL.md` to at least one motivating case for each
high-risk capability. Command-stream equality localizes semantic agreement before raster
differences are considered.

## Decision rule

Prefer explicit unsupported behavior over an attractive fake fallback. Add a fallback only
when users can select or observe its different semantics and reproduction evidence shows
it remains useful. Update the operation contract and support matrix before implementing
that fallback, not afterward.
