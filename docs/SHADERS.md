# @vulcania/shaders — the shader builder package

Status: **planned** (design doc — implement in the arc described here).
Depends on: `@vulcania/bindings` (SDL_shadercross + `SDL_free` from the sdl
bindings). Consumed by: `@vulcania/gpu` (render states), apps authoring
custom shaders, and the phase 2.5 SDF spike — which is this package's
first integration test.

## Purpose

Author shaders in TypeScript, compile them to every format SDL supports,
and keep the renderer's uniform writes in lockstep with the shader source.
One HLSL source per shader; shadercross cross-compiles it at startup to
MSL / DXIL / SPIRV per platform. No TS→SPIRV compiler — the builder is a
typed descriptor + emitter + compile API, not a language.

The generated bindings stop at raw pointers. Everything between "C function
with `pointer` args" and "usable compiled shader" is this package's job:

- struct packing (`SDL_ShaderCross_HLSL_Info`, `SDL_ShaderCross_SPIRV_Info`,
  `SDL_ShaderCross_GraphicsShaderResourceInfo`) into ArrayBuffers,
- the `size_t *` out-params the generated wrappers neither allocate nor
  read back,
- C-string decode of transpile results and bytecode copy-out,
- `SDL_free` of every SDL_malloc'd result (SDL's allocator, never the JS
  heap — `SDL_free` is already bound in the sdl library).

## Layering

- Depends on `@vulcania/bindings` only. Not in eslint `PURE_LAYERS` (same
  carve-out as `gpu`: it exists to wrap FFI). No eslint block needed.
- `gpu` consumes it: `SDL_CreateGPUShader` / `SDL_SetGPURenderState*` are
  already bound and confirmed (sdl generated functions + wrappers).
- Scaffold mirrors `packages/fonts`/`gpu`: bun-style tsconfig, `exports:
{ ".": "./src/index.ts" }`, root devDependency `"@vulcania/shaders":
"workspace:*"`.
- The shadercross dylib story is already solved: pinned by `version.lock`,
  built by `build-sdl-shadercross.yml` (flat FFI archive + CLI archive per
  platform), fetched by `setupFfiCopy` (`Library.SDL3Shadercross` →
  `libSDL3_shadercross.*`), loaded lazily by the bindings
  (`VULCANIA_SDL3_SHADERCROSS_PATH` → platform candidates).

## API surface (v1)

```ts
// The uniform descriptor — the single source of truth. The HLSL struct
// block + the JS setter are BOTH generated from it, so they cannot drift.
interface UniformDescriptor {
  name: string;                    // HLSL + JS name
  type: "float" | "vec2" | "vec3" | "vec4" | "mat4";
}

interface ShaderDescriptor {
  name: string;                    // debug name (SDL_SHADERCROSS_PROP_SHADER_DEBUG_NAME)
  stage: "vertex" | "fragment";    // SDL_SHADERCROSS_SHADERSTAGE_*
  entrypoint: string;              // e.g. "main"
  uniforms: UniformDescriptor[];
  hlsl: string;                    // the shader body — entrypoint + constants
                                   // are emitted around it from the descriptor
  defines?: Record<string, string>; // SDL_ShaderCross_HLSL_Define array
}

// Compile one descriptor to every format the host shadercross supports.
compileShader(descriptor: ShaderDescriptor): CompiledShader;

interface CompiledShader {
  spirv?: ArrayBuffer;   // SDL_ShaderCross_CompileSPIRVFromHLSL
  dxil?: ArrayBuffer;    // SDL_ShaderCross_CompileDXILFromHLSL (windows)
  dxbc?: ArrayBuffer;
  msl?: string;          // SDL_ShaderCross_TranspileMSLFromSPIRV (macos) — decoded string
  formats: number;       // GetHLSLShaderFormats bitmask actually produced
  uniforms: UniformDescriptor[];   // in declaration order — offsets are
                                   // sequential std140-ish, computed here
}

// Init/Quit + capability query, idempotent (lazy behind the bindings'
// lazyload proxy).
initShadercross(): void;
shadercrossFormats(): number;
```

The compile path: HLSL source → `SDL_ShaderCross_CompileSPIRVFromHLSL`
(allocate the `size_t` out-buffer, pass the packed `HLSL_Info`, copy the
returned buffer into an `ArrayBuffer`, `SDL_free`) → for MSL,
`SDL_ShaderCross_TranspileMSLFromSPIRV` on that SPIRV (C-string decode +
free). DXIL/DXBC are Windows-only and compile straight from HLSL.

Struct packing lives in one module (`structs.ts`): little-endian writers
per struct with a `byteLength` computed from the header's field list —
hand-maintained, pinned to the vendored header, and covered by a byte
-layout test that fails loud when the submodule pin moves.

## Uniform write side (the drift-killer)

`CompiledShader.uniforms` is the same `UniformDescriptor[]` the HLSL was
generated from. `gpu` gets a setter that walks it and writes
`SDL_SetGPURenderStateFragmentUniforms` (or the sampler slots) in
declaration order — descriptor in, descriptor out. Changing a uniform in
TS changes the emitted HLSL struct and the setter together; a mismatch is
a type error at authoring time, not a GPU garbage-value at runtime.

## The SDF spike arc (first consumer)

1. **Probe (go/no-go)**: one fragment shader — solid red — compiled
   through this package into a `SDL_GPUShader`, wrapped in
   `SDL_CreateGPURenderState`, drawn through `SDL_SetGPURenderState` in
   the batched renderer alongside a normal fill. Verified by GPU
   pixel-readback (not the software driver). Kill criteria: if the
   render state cannot coexist with the batched `SDL_RenderGeometry`
   pass (state invalidation, vertex-format conflicts, driver quirks),
   the spike stops and the CPU paths stay.
2. **SDF shader**: `roundedBoxSDF` in the fragment stage — fill + border
   - 1px AA band + blur falloff from one quad; per-rect params
     (halfSize, radius, border, blur, two colors) ride vertex attributes.
3. **Painter integration**: `sdfRect` capability flag on the Painter
   surface (`SDL_GetGPUShaderFormats` + render-state probe at renderer
   init); `paintBackground`/`paintBorder`/`paintShadow` route through it
   when available, the stacked-layer CPU paths stay as the permanent
   fallback for software-driver renders.
4. **Then batch 5** (Canvas 2D + Path2D/tessellation) targets the
   renderer conclusions this locks in — vertex attribute layout first,
   tessellation second.

## Testing

- Byte-layout tests for every packed struct (fail loud on submodule pin
  moves).
- Compile tests gated on the dylib being present (`VULCANIA_SDL3_SHADERCROSS_PATH`
  via the bunfig preload / release dylibs): compile the probe shader,
  assert non-empty SPIRV + decoded MSL string; skipped when absent, like
  the GPU pixel tests.
- Negative test: garbage HLSL → the thrown error surfaces shadercross's
  message (the raw pointer return is null on failure — decode + free
  still runs).
- No golden blobs in v1 (compilation is nondeterministic across
  shadercross versions); the offline-blob caching story is future work.

## Out of scope (v1)

- Entry-point/graph emitter niceties beyond the struct + constants block.
- Compute pipelines (`CompileComputePipelineFromSPIRV` — bound, unwrapped;
  wrap when compute arrives).
- Disk cache of compiled blobs; a CLI for offline compilation.
- `SDL_ShaderCross_ReflectGraphicsSPIRV` metadata surfacing (bound;
  unwrapped — needed when uniform reflection replaces declared
  descriptors, if ever).

## Doc touchpoints on landing

- `docs/FFI.md` — shadercross block gains the package pointer.
- `docs/RENDERING.md` — the SDF section points here instead of
  "everything needed is already bound".
- `docs/ROADMAP.md` — phase 2.5 becomes: probe → shader via
  `@vulcania/shaders` → capability flag; batch 5 ordering note.
- `docs/ARCHITECTURE.md` — package tree + layering row (shaders →
  bindings; gpu → shaders + bindings).

## Implementation order after approval of the doc

1. Scaffold `packages/shaders` (@vulcania/shaders, dep @vulcania/bindings
   only; not in PURE_LAYERS; root devDep).
2. `structs.ts` (LE struct writers + byte-layout tests) → `compile.ts`
   (HLSL_Info/SPIRV_Info packing, size_t out-param, SDL_free, copy-out) →
   `descriptor.ts` (uniform descriptor → HLSL emission) → barrel.
3. SDF probe shader as the first consumer; go/no-go; then painter
   integration per the spike arc.
4. Doc touchpoints listed above.

Verification: compile the probe shader on macOS (SPIRV + MSL non-empty,
MSL decodes as text), byte-layout struct tests, garbage-HLSL negative
test, existing suite untouched.
