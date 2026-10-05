# SHW-213 — Upgrade to Rapier 0.36.0

## Description

Consolidate the Rapier engine and JavaScript forks in the updated engine repository while preserving KaDshow's native collision filtering and binding behaviour. Produce a compatible 3D build and package, integrate it with KaDshow, and validate correctness and performance.

The engine feature branch is based on `develop` at `fc546bba162df812107a206a99dacb6209b389f5`. Upstream `master` is `846c463e47ef654d6a6ce6fa0e455f3a1e98c2ec` and is not merged. The old JavaScript fork's `develop` reference is `aaf7c5a620922d240597b9e5978e374fff3badf2`.

Status: the feature branch has been created. Upstream merge, implementation, builds and testing have not started.

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
