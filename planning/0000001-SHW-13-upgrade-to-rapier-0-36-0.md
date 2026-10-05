# SHW-213 — Upgrade to Rapier 0.36.0

## Description

Consolidate the Rapier engine and JavaScript forks in the updated engine repository while preserving KaDshow's native collision filtering and binding behaviour. Produce a compatible 3D build and package, integrate it with KaDshow, and validate correctness and performance.

The engine feature branch is based on `develop` at `fc546bba162df812107a206a99dacb6209b389f5`. The selected upstream merge baseline is `master` at `846c463e47ef654d6a6ce6fa0e455f3a1e98c2ec`. The old JavaScript fork's `develop` reference is `aaf7c5a620922d240597b9e5978e374fff3badf2`.

Status: steps 1–7 are complete for the authorized non-SIMD 3D package scope. Parent accepted formal validation: 105 functional tests passed (87 native, 8 binding, 10 focused Jest), production package build and actual tarball CJS/ESM/strict TypeScript 4.8 proof passed for `@chargeuk/rapier3d-compat@0.21.0-chargeuk.1`. Step 6 KaDshow-specific tests are deferred with integration in step 8. Steps 8–10 have not started; the whole upgrade is not complete.

## Out of scope

Work beyond the latest agreed baseline of engine `0.36.0` and bindings `0.21.0` is out of scope. New clothing simulation or features, unrelated importer/UI/server rewrites or cleanup, and unrelated native bindings or testbed projects are excluded. Compatibility fixes, toolchain setup, regression tests and baseline performance validation required for this upgrade are in scope.

## Implementation plan

The target is **Rapier engine 0.36.0 with JavaScript bindings 0.21.0**, preserving the behaviour KaDshow needs from both forks. Clothing simulation would follow as separate work.

Implementation would go through `coding_agent` using the Agents MCP, reusing worker conversations for follow-ups. `automated_testing_agent` would perform builds and validation without changing code. I would review completed diffs and investigate substantive failures before delegating fixes.

1. **Create the upgrade branch and merge upstream**

   - Create `feature/SHW-213-upgrade-to-rapier-0.36.0` from the engine fork’s `develop`.
   - Merge its newly updated `origin/master`.
   - Resolve conflicts against the current architecture, documenting which custom changes remain necessary.
   - Use the old JavaScript fork as a reference for porting changes into `bindings/typescript`.

2. **Establish the build environment**

   - Install a suitable Rust toolchain, the WASM target and required build tools.
   - Install the locked JavaScript dependencies.
   - Configure a repeatable build for the 3D compatibility package.
   - Record tool versions and commands; avoid building unrelated native testbeds and bindings.

3. **Preserve the engine’s custom collision behaviour**

   - Port the three additional grouping fields and their filtering rules.
   - Preserve upstream’s standard `And`/`Or` semantics.
   - Apply the custom predicate through the shared filtering path used by broad and narrow phases.
   - Ensure mask changes correctly invalidate and rediscover collision pairs.
   - Keep solver filtering separate from collision filtering.
   - Reassess the old callback removals against the new implementation.

4. **Port the JavaScript fork’s required behaviour**

   - Preserve `setDetailedCollisionGroups` and the corresponding descriptor properties.
   - Carry custom values through collider creation and subsequent updates.
   - Preserve revolute limits supplied during joint creation.
   - Verify joint-anchor updates and collider resizing using the upstream APIs.
   - Ensure the bindings build against the customised engine in the same repository.

5. **Adapt package generation**

   - Retain the `@chargeuk/rapier3d-compat` identity.
   - Give the package a distinct version based on bindings version `0.21.0`.
   - Update package templates, exports, declarations and publishing configuration.
   - Preserve useful optimisation settings and select the appropriate WASM variant.
   - Assess whether optional FEM support belongs in our build.

6. **Add regression coverage**

   - Rust tests for standard groups, custom groups, matching and differing grouping IDs, excluded pairs and runtime mask changes.
   - Binding tests for descriptor propagation, setters, solver-group separation, revolute limits, anchors and resizing.
   - Package tests for initialisation, exports and TypeScript declarations.
   - KaDshow Jest tests for the integration paths changed during migration.

7. **Build and validate the package**

   - Have the testing agent run the relevant engine and binding tests and production package build.
   - Produce an installable tarball and verify its contents.
   - Review failures myself, then delegate code corrections to the coding agent.
   - Record package size and confirm the intended WASM variant was produced.

8. **Integrate with KaDshow**

   - Create a corresponding KaDshow feature branch from current `develop`.
   - Use a local link for development where useful, and the tarball for reproducible package and Docker validation.
   - Adapt required imports, initialisation and physics APIs.
   - Verify worker bundling, disposal and dependency resolution.
   - Establish a dependency delivery method that also works in CI and Docker without local symlinks.

9. **Validate behaviour and performance**

   - Capture a baseline using the existing package, then compare the upgraded package.
   - Exercise both hairstyles, character collisions, multiple characters, morph-driven collider resizing, sleeping and scene teardown.
   - Measure physics-step timings, including slower frames, alongside visible stability and memory.
   - Investigate changed CCD, contact and sleeping defaults where they affect behaviour.
   - Delegate suites, builds and browser validation to the testing agent; leave iPhone testing to you.

10. **Review and deliver**
    - Review both feature-branch diffs for correctness, unnecessary code and KISS.
    - Confirm every retained fork behaviour has meaningful coverage.
    - Document build instructions, package integration, results and remaining limitations.
    - Commit and push the feature branches, leaving the upgrade ready for review before clothing simulation begins.

## Historical progress notes — steps 1 and 2

- **Step 1:** merged `origin/master` (`846c463e`) into the existing feature branch with merge commit `1dd6615e` (parents `77180ebf`, `846c463e`); no push. Resolved six conflicts: engine manifests, collision-group examples, interaction groups and the obsolete narrow-phase file. Retained custom native fields/predicate and workspace optimizations while accepting upstream constructors, And/Or semantics and split narrow-phase active-hook handling. Full collision correctness, solver separation and callback-removal assessment remain step 3; no old JavaScript APIs or namespace were ported.
- **Step 2:** installed Rust/Cargo 1.99.0, rustup 1.29.1, the WASM target, rustfmt/Clippy, official wasm-pack 0.15.0, wasm-bindgen CLI 0.2.129 and Binaryen 133. Installed user-local Node 24.21.0 LTS/npm 12.2.0 while preserving the shared existing runtime. Existing Debian compiler/libraries were sufficient; no OS, GUI/testbed or unrelated binding dependencies were installed. Both npm roots were installed from unchanged lockfiles with lifecycle scripts disabled (41/496 packages).
- **Scoped validation complete:** the parent's automated_testing_agent reported PASS for native `cargo build -p rapier3d --lib`, the dim3/non-deterministic generator, no-install 3D WASM build, 3d-only source generation, Rollup and raw declaration repair. Generated package checks, CJS/ESM initialization and World step/free smoke checks, and `npm pack --dry-run` also passed: `@dimforge/rapier3d-compat@0.21.0`, 54 package files. Binding Cargo resolution uses wasm-bindgen `0.2.129`, matching the CLI. No unexpected tracked build side effects were reported. No full suites or frontend integration checks ran; these results are not fork behavioral/regression proof or completion of later steps.
- **Recorded artifacts and inventory:** [3D build/setup instructions and complete inventory](../bindings/typescript/BUILDING_3D_COMPAT.md) now record existing native/WASM/package paths, relevant resolved Rust versions, installed tools and OS/npm prerequisites alongside unchanged upstream constraints. Generated files exist under root `target/`, `bindings/typescript/builds/rapier3d/`, `bindings/typescript/target/` and `bindings/typescript/rapier-compat/builds/3d/`; no actual tarball was produced. Documentation was updated from the compact report and generated metadata without reading successful logs or rerunning checks. Reviewed setup code and docs remain uncommitted for parent review; the merge is already committed. At that initial validation point, steps 3–10 were unstarted.

## Completed scoped port — steps 3–7 (2026-10-05)

- **Step 3 complete for 3D:** retained custom fields/predicate with upstream And/Or priority and existing GROUPS-triggered BVH reinsertion. Native tests passed 87/87 (81 library + 6 integration), covering stationary contact/sensor mask invalidation/rediscovery, standard/custom groups, solver separation and opt-in hooks. No speculative engine/filter rewrite; callbacks remain gated by ActiveHooks.
- **Step 4 complete for 3D:** detailed setter, three descriptor fields/defaults/fluent setters and creation propagation are ported, preserving upstream raw creation signatures and neutral standard/query/solver unpacking. Creation-time revolute limits retain the independent-axis path; upstream anchors/resizing are reused and the old solver-setter bug is excluded. Binding tests passed 8/8 and focused 3D Jest passed 10/10. 2D source consistency is retained, but 2D build/behavior proof was not run.
- **Step 5 complete for selected package:** regenerated `@chargeuk/rapier3d-compat@0.21.0-chargeuk.1` with fork metadata, CJS/ESM/types exports and public publication config; authorship/license and internal Rust/WASM identifiers/binding version remain upstream. Release LTO/opt-level 3 and existing wasm-opt flags are retained. The validated variant is non-SIMD 3D; FEM remains enabled for existing upstream soft-body binding APIs. The declaration repair omits only generated Symbol.dispose method typings for TS 4.x, preserving manual free(), other types and runtime code.
- **Step 6 complete within assignment:** 105 functional tests passed, plus packed-package exports/init/World step/free and strict TypeScript 4.8 consumer checks. KaDshow-specific tests are explicitly deferred to step 8 integration. Format checks passed for four binding Rust files (edition 2018, skip_children=true), the native integration test (edition 2024), seven touched TS/JS/CJS files and syntax checks for three build scripts. The source checker initially used the wrong binding edition; correcting its configuration required no source changes.
- **Step 7 complete:** generator, 3D WASM build, source generation, Rollup and declaration repair passed, followed by actual packed-package CJS/ESM initialization, World step/free, exports and strict TS 4.8 proof. Package has 54 files: 4,953,294 tarball bytes, 14,839,187 unpacked bytes and 3,023,981 WASM bytes. Tarball: `/tmp/rapier-chargeuk-package-ZXU1pr/chargeuk-rapier3d-compat-0.21.0-chargeuk.1.tgz`; regenerated package: `bindings/typescript/rapier-compat/builds/3d/pkg`.
- **Bounded diagnoses:** repaired one unchanged upstream degenerate-mesh unit call with default flags `0`, retaining its None assertion. Hook opt-in is tested before first step because upstream set_active_hooks does not dirty stationary pairs. Axis assertions use actual frame rotations because native local_axis getters apply a translated Pose point; native getters and JS frameX paths remain unchanged. Parentless JS fixtures explicitly enable FIXED_FIXED because upstream ALL omits that bit; the production enum is unchanged. These upstream quirks are recorded, not silently changed by the port.
- **Evidence and boundary:** parent accepted compact successful tester reports without reading success logs. Proof ran on native ARM64 with image Node 22.21.1, Rust/Cargo 1.99.0 and matching wasm-bindgen CLI/Cargo 0.2.129, without installs/new dependencies. npm lockfiles are unchanged; no other repositories or unexpected tracked files changed. Repeatable commands and mapping are in `bindings/typescript/BUILDING_3D_COMPAT.md`. No browser, KaDshow, performance, 2D, SIMD or iPhone proof, publication, commit or push occurred in this scope. Steps 8–10 and clothing work remain unstarted; the whole upgrade remains incomplete.
