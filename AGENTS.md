# Repository guidance

## Project and scope

This repository contains Chargeuk KaDshow's customised Rust physics engine and the intended home for its WebAssembly/TypeScript compatibility package. The agreed upgrade target is Rapier engine `0.36.0` with JavaScript bindings `0.21.0`. Keep the package identity `@chargeuk/rapier3d-compat` and give it a distinct package version.

The upgrade covers compatibility, build/toolchain work, regression coverage and performance validation needed to preserve KaDshow behaviour. Clothing simulation and new clothing features are separate work. Unrelated importer, UI, server, cleanup, native binding and testbed projects are out of scope unless a specific change is required to complete this upgrade.

User, system and developer instructions take precedence over this file. Work only within the user-authorized scope; preparing documentation does not start implementation. Explicit user approval and authorization persist across follow-ups. Do not create new permission requirements.

## Checkout facts and provenance

At documentation time, the feature branch `feature/SHW-213-upgrade-to-rapier-0.36.0` was based on `develop` at `fc546bba162df812107a206a99dacb6209b389f5`. Upstream `master` was `846c463e47ef654d6a6ce6fa0e455f3a1e98c2ec` and had not been merged. At that baseline, `crates/rapier3d/Cargo.toml` reported version `0.17.2` and pointed to `../../src/lib.rs`. Confirm the current checkout before relying on these historical facts.

The baseline checkout has shared `src/` and `crates/` trees, `src_testbed/`, `examples2d/`, `examples3d/`, `examples3d-f64/`, `benchmarks2d/` and `benchmarks3d/`. The workspace includes 2D/3D and f32/f64 engine crates, testbeds, examples and benchmarks. The target adds `bindings/typescript` and other upstream bindings, which were absent from the documentation-time checkout; verify merge state before relying on that layout. The old JavaScript fork at `/home/dan/code/rapier.js`, branch `develop` commit `aaf7c5a620922d240597b9e5978e374fff3badf2`, is a read-only reference for porting, not a place to edit.

Current `src/geometry/interaction_groups.rs` contains `belongs_to_with_grouping`, `collides_with_with_grouping` and `belongs_to_grouping`, with a custom predicate in `test()`. Preserve evidence about their actual behaviour when porting. Pay particular attention to broad- and narrow-phase filtering, runtime pair rediscovery after mask changes, and separation of collision filtering from solver filtering. Preserve upstream `And`/`Or` semantics. Also verify descriptor fields and setters, revolute limits, joint anchors and collider resizing against the merged APIs. For bindings, verify package exports, declarations, WASM selection, initialization and disposal.

Existing documentation includes `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md` and `CHANGELOG.md`. Current build command evidence is in `.github/workflows/rapier-ci-build.yml` (including formatting check, Cargo builds/tests and explicit WASM-target builds). Discover applicable commands from the checked-out manifests and CI at implementation time. After merge, inspect the TypeScript binding documentation, manifests and scripts before relying on them. Toolchain and installed-tool versions must be checked when needed; this file does not assert their availability. Do not run the cited commands merely because they are documented here.

## Research and repository tools

For repository research, use `code_info` first with explicit repository paths. Reuse returned conversation IDs for follow-up questions within each working session, then inspect cited source directly with bounded reads. If `code_info` is unavailable or a repository is not indexed, use `rg`, `rg --files`, `git` and bounded read-only `sed` reads, report the limitation, and do not install tools or trigger reindexing automatically. Exact requested file reads, applicable `AGENTS.md` files, plans and status checks are reasonable exceptions.

Use Context7 for current API or version migration documentation and DeepWiki for upstream architecture when relevant. Distinguish upstream evidence from local fork behaviour; use neither service when it does not help answer the question.

`CODEINFO_ROOT` identifies the harness repository, not this Rapier checkout. Keep harness paths and target repository paths distinct. Use existing planning helpers only when `CODEINFO_ROOT`, the scripts and applicable plan/handoff data are available. Run helpers from the target repository root, use their compact default output, and request only the needed section or profile before expanding. If helper interfaces are unclear, check `--help`. Adapted read-only examples include:

```sh
python3 "$CODEINFO_ROOT/scripts/plan_status.py" --plan planning/0000001-SHW-13-upgrade-to-rapier-0-36-0.md
python3 "$CODEINFO_ROOT/scripts/plan_sections.py" --profile story-scope
python3 "$CODEINFO_ROOT/scripts/story_workflow_status.py"
```

Do not fabricate wrappers, require unavailable helpers, or write handoffs just to satisfy guidance. If helpers or plan data are unavailable, use `wc -l`, `rg -n` for headings and bounded `sed` ranges. Preserve the supplied numbered plan schema.

## Plan and task workflow

Read the active story and task handoff, including its current Markdown step and stopping rule, before implementation. Maintain plan progress honestly: implementation checkboxes and notes describe work actually completed. `coding_agent` owns documentation and implementation/progress edits; the orchestrator reviews and coordinates them. The testing agent reports validation evidence only and never changes any repository file. Coordinate plan edits sequentially to avoid overlapping writers. The supplied upgrade plan has no checkboxes: preserve its steps and record actual progress separately when implementation is requested. Branch creation was the only completed upgrade activity at documentation time. Preparing documentation does not complete implementation steps or launch an automatic full Testing phase.

Follow the assignment's user-authorized scope and stopping rule, including any commit boundary. Carry forward explicit authorization rather than requesting it again. Documentation preparation alone does not authorize upstream merges or implementation.

## Implementation and evidence standards

Follow KISS: keep changes small, grounded in current source and consistent with repository style. Avoid speculative rewrites. Preserve provenance for upstream and fork-specific behaviour. Add meaningful regression coverage for custom and standard interaction groups, runtime updates, joints, colliders, initialization, exports and declarations, plus KaDshow integration paths affected by migration. Tests should exercise behaviour rather than mirror implementation details.

Discover commands from current manifests and CI. Scope validation to required 3D compatibility surfaces instead of automatically building every native testbed, example or binding. Delegate builds, test suites, typechecks, lint checks and format checks to `automated_testing_agent` strictly for validation. Validation may produce build artifacts and logs, but the tester must never change source, configuration, tests or documentation, including through auto-fix or formatter writes. Delegate mutating formatter or lint fixes, configuration changes, installs, documentation and other coding work to `coding_agent`. Follow explicit task requirements for focused or full-suite validation. Keep evidence compact and report actual commands, scope, pass/fail/skip counts, failures and relevant environment or artifact details. Never claim an unrun check passed. Establish a performance baseline with the current package before comparison; record timings, stability and memory. The user will manually test on iPhone.

Use the exact feature branch name `feature/SHW-213-upgrade-to-rapier-0.36.0`; do not substitute another naming pattern. When commits are authorized, messages start with `SHW-213 -` and have a 4–5 sentence body describing changes, reasons, validation and limitations.

## Delegation policy

research/orchestrator diagnoses issues and proves findings. Delegate coding tasks (including logging/tests/source/config) to coding_agent via Agents MCP run_agent_instruction and reuse conversation IDs. Research may make minor one-line changes only. Delegate builds and test suite execution to automated_testing_agent strictly for validation; it must NEVER perform coding tasks or minor fixes. Coding agent may run only narrowly targeted tests while fixing issues, NEVER full suites. If delegation unavailable, report limitation; don't implement/build/test yourself. Request concise final reports, review completed diffs/evidence, do not watch/monitor ongoing workers. Accept compact successful tester status without reading output/logs. For failed builds/tests first ask tester for concise failure details, log paths and exact line ranges, then read only those sections; diagnose yourself and delegate code fixes to coding_agent. Only after exhausting your diagnosis options ask research_agent_max via Agents MCP, with evidence/tried options/unresolved question. User will manually test iPhone. Never claim undocumented builds/tests passed.
