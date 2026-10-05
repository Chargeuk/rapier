# 3D compatibility build and fork port (SHW-213)

The merged engine **0.36.0** and bindings **0.21.0** now produce the validated
**`@chargeuk/rapier3d-compat@0.21.0-chargeuk.1`** package with the required fork APIs.
Scoped steps 3–7 implementation and formal proof are complete for non-SIMD 3D.
Step 6 KaDshow-specific tests are deferred with step 8 integration; steps 8–10
remain unstarted and the whole upgrade is not complete.

Results below are the parent's accepted compact tester reports. Successful logs
were not opened, and this documentation update ran no builds or tests.

## Current scoped port proof (2026-10-05)

| Proof surface                                                              | Accepted result                                                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Native library + detailed collision integration                            | PASS 87/87: 81 library + 6 integration                                                                     |
| Binding library                                                            | PASS 8/8                                                                                                   |
| Focused Chargeuk 3D Jest                                                   | PASS 10/10                                                                                                 |
| Generator, 3D WASM build, source generation, Rollup and declaration repair | PASS                                                                                                       |
| Actual tarball CJS/ESM exports, initialization and World step/free         | PASS                                                                                                       |
| Strict TypeScript 4.8 packed-package consumer, without skipLibCheck/shims  | PASS; Symbol.dispose typings omitted, manual free() and runtime preserved                                  |
| Rust formatting                                                            | PASS: four binding files with edition 2018 + skip_children=true; native integration test with edition 2024 |
| Prettier and script syntax                                                 | PASS: seven touched TS/JS/CJS files; three build scripts                                                   |

**105 functional tests passed within the scoped proof; full-workspace suites were not run.** Proof used the image's Node **22.21.1**,
Rust/Cargo **1.99.0** and matching wasm-bindgen CLI/Cargo **0.2.129** on native
ARM64 only, with no installs/new dependencies. npm lockfiles stayed unchanged;
no other repositories or unexpected tracked files changed.

The package contains **54 files**, with **4,953,294 tarball bytes**,
**14,839,187 unpacked bytes** and **3,023,981 WASM bytes**. Regenerated package:
`bindings/typescript/rapier-compat/builds/3d/pkg`. Actual tarball:
`/tmp/rapier-chargeuk-package-ZXU1pr/chargeuk-rapier3d-compat-0.21.0-chargeuk.1.tgz`.
The `/tmp` artifact is disposable; commands below reproduce it.

No browser/KaDshow integration, performance comparison, 2D/SIMD or iPhone proof
was run. Publication, commit and push were not performed in this scope.

## Historical initial baseline (steps 1–2)

The initial package was `@dimforge/rapier3d-compat@0.21.0`, with 54 files in a pack
dry-run. These earlier build/smoke results precede the fork port and are retained
as provenance; the current package and regression results are above.

| Assigned scope                                                                              | Tester result                                              |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Native `cargo build -p rapier3d --lib` and `prepare_builds` for dim3/non-deterministic      | PASS                                                       |
| WASM build in no-install mode, 3d-only source generation, Rollup and raw declaration repair | PASS                                                       |
| Generated package checks and `npm pack --dry-run`                                           | PASS; `@dimforge/rapier3d-compat@0.21.0`, 54 package files |
| CJS and ESM initialization, `World` step/free smoke checks                                  | PASS                                                       |

The tester reported no unexpected tracked build side effects. This proves the scoped build/package baseline and basic smoke execution only; it does not prove fork behavior or regression correctness. No full suites or frontend integration checks were run. Standalone typecheck and lint/format checks are not recorded as validated. At that baseline validation point, steps 3–10 were unstarted. Current port results and repeatable commands are recorded separately; KaDshow integration and performance validation remain unstarted.

## Historical installed environment and origins (2026-10-05)

Historical steps 1–2 setup host: Debian 12, `aarch64`, user `node`, actual `$HOME=/app/codex`. Installations are user-local and do not replace `/usr/local/bin/node` or affect live containers. No OS packages were installed or upgraded.

| Direct tool                    | Actual version                                        | Status and origin                                                                                               |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| rustup                         | 1.29.1                                                | Newly installed using official `https://sh.rustup.rs`                                                           |
| rustc / Cargo                  | 1.99.0 / 1.99.0                                       | Newly installed latest stable channel, released 2026-10-01; official Rust distribution                          |
| rustfmt / Clippy               | 1.10.0-stable / 0.1.99                                | Newly installed official 1.99.0 components; not executed for validation                                         |
| Rust targets                   | `aarch64-unknown-linux-gnu`, `wasm32-unknown-unknown` | Newly installed official standard libraries                                                                     |
| Node / npm, container defaults | 22.21.1 / 10.9.4                                      | Pre-existing `/usr/local/bin`, retained untouched                                                               |
| Node / npm, scoped tools       | 24.21.0 LTS (Krypton) / 12.2.0                        | Newly installed official Node Linux ARM64 archive / npm registry; latest LTS and latest compatible npm at setup |
| wasm-pack                      | 0.15.0                                                | Newly installed official `wasm-bindgen/wasm-pack` Linux ARM64 musl release                                      |
| wasm-bindgen CLI               | 0.2.129                                               | Newly installed official `wasm-bindgen/wasm-bindgen` Linux ARM64 musl release                                   |
| wasm-opt                       | Binaryen 133                                          | Newly installed official `WebAssembly/binaryen` Linux ARM64 release                                             |

Latest versions were checked against the official GitHub release APIs, Node's `https://nodejs.org/dist/index.json`, the npm registry and crates.io. The validated binding workspace resolved wasm-bindgen **0.2.129**, matching the installed CLI and satisfying the upstream requirement `0.2.109` (a caret range). A later Cargo resolution must still use a matching CLI; the no-install validation mode fails rather than installing another tool automatically. Latest installed tool versions are separate from the compatible upstream project pins retained below.

Pre-existing direct OS prerequisites, retained at the container's Debian versions: `build-essential 12.9`; `gcc`/`g++ 4:12.2.0-3`; `gcc-12`/`g++-12 12.2.0-14+deb12u1`; `binutils 2.40-2`; `make 4.3-4.1`; `libc6-dev 2.36-9+deb12u14`; `curl 7.88.1-10+deb12u15`; `ca-certificates 20250419~deb12u1`; `tar 1.34+dfsg-1.2+deb12u1`; `xz-utils 5.4.1-1+deb12u2`. Existing Python is `python3 3.11.2-1+b1`; it is not a Python-binding dependency here. Newer standalone compilers, GUI libraries, CMake, Python/Bevy/C bindings and native testbed dependencies are unnecessary for this scoped build and were not installed.

Existing shell/archive prerequisites are `bash 5.2.15-2+b10`, `coreutils 9.1-1`, `findutils 4.9.0-4`, `sed 4.9-1` and `gzip 1.12-1`; existing Git is `1:2.39.5-0+deb12u3`. Native runtime libraries are `libc6 2.36-9+deb12u14`, `libgcc-s1 12.2.0-14+deb12u1` and `libstdc++6 12.2.0-14+deb12u1`. These were read from installed package metadata and remain unchanged.

## Historical user-local setup reproduction

The current CodeInfo2 image already contains the required tools under `/opt` (see current commands below); do not repeat these historical installations or prepend old HOME tool paths to fix login-shell PATH loss. For reproducing the original user-local setup in a different container, use the same Debian ARM64 prerequisites listed above. If they are missing, provision `build-essential`, `curl`, `ca-certificates`, `tar`, `xz-utils`, `gzip`, `bash`, `coreutils`, `findutils`, `sed` and Git using the container's OS package manager before these commands. This container has no `sudo`; none was needed for the user-local installations.

The following pins reproduce the recorded tools; consult official stable releases when intentionally updating this setup. Do not change Rapier's agreed engine/bindings baseline or mass-upgrade project dependencies along with tools.

```bash
set -e
curl --proto '=https' --tlsv1.2 -fsS https://sh.rustup.rs -o /tmp/rapier-rustup-init.sh
sh /tmp/rapier-rustup-init.sh -y --profile minimal --default-toolchain 1.99.0 --no-modify-path
. "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown
rustup component add rustfmt clippy
mkdir -p "$HOME/.local/bin" /tmp/rapier-setup

rapier_install_archive() {
    rapier_archive="/tmp/rapier-setup/$1.archive"
    rapier_destination="$HOME/.local/lib/$2"
    curl --proto '=https' --tlsv1.2 -fsSL "$3" -o "$rapier_archive"
    printf '%s  %s\n' "$5" "$rapier_archive" | sha256sum -c -
    mkdir -p "$rapier_destination"
    tar -xf "$rapier_archive" --strip-components=1 -C "$rapier_destination"
    ln -sfn "$rapier_destination/$4" "$HOME/.local/bin/$1"
}
rapier_install_archive wasm-pack wasm-pack \
  https://github.com/wasm-bindgen/wasm-pack/releases/download/v0.15.0/wasm-pack-v0.15.0-aarch64-unknown-linux-musl.tar.gz \
  wasm-pack e17ef0806381c3a0acb9c9ddad643a49facaa5a2ecf657a421d4d8f3357a24b7
rapier_install_archive wasm-bindgen wasm-bindgen \
  https://github.com/wasm-bindgen/wasm-bindgen/releases/download/0.2.129/wasm-bindgen-0.2.129-aarch64-unknown-linux-musl.tar.gz \
  wasm-bindgen 2ed4351c35dd9440308bbb02767d47ea278efe851a52465300f3c94f5b6c2a87
rapier_install_archive wasm-opt binaryen \
  https://github.com/WebAssembly/binaryen/releases/download/version_133/binaryen-version_133-aarch64-linux.tar.gz \
  bin/wasm-opt 89c07ea56faf38d0fbecf36ca8ec0721756716185f265b568e133d427f299bf8
rapier_install_archive node node-v24.21.0 \
  https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-arm64.tar.xz \
  bin/node 6ad1325edbdb5649c379b75a237147a666c95d4f9ae8d340fef2d1575d289ad2
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
node "$HOME/.local/lib/node-v24.21.0/lib/node_modules/npm/bin/npm-cli.js" \
  install --global --prefix "$HOME/.local" --ignore-scripts --no-audit --no-fund npm@12.2.0
```

The wasm-bindgen, Binaryen and Node archive hashes were checked against official release checksum files. The wasm-pack hash records the archive downloaded over HTTPS. Other tools bundled in those archives remain in their extracted directories; only the required binaries above are added to PATH. The Rust installer reported that `$HOME` differs from the account's `/home/node`; installation nevertheless succeeded under the existing `/app/codex` home, without changing `$HOME`.

## Locked npm dependencies

These installations have completed; do not enable lifecycle scripts. The bindings root added 41 packages, and `rapier-compat` added 496 packages. Both tracked lockfiles are unchanged; no testbed or website dependency tree was installed.

```bash
set -e
export PATH="/opt/cargo/bin:/opt/wasm-tools/bin:/opt/binaryen/bin:$PATH"
cd /home/dan/code/rapier/bindings/typescript
npm ci --ignore-scripts --no-audit --no-fund
cd rapier-compat
npm ci --ignore-scripts --no-audit --no-fund
```

Direct installed package versions are listed below. Registry `latest` is an informational setup-time snapshot, not an upgrade instruction. All upstream pins and lock resolutions are retained for compatibility.

| Package                     | Bindings root | Compat root | Registry latest |
| --------------------------- | ------------- | ----------- | --------------- |
| prettier                    | 2.7.1         | —           | 3.9.9           |
| typedoc                     | 0.23.19       | —           | 0.28.20         |
| typescript                  | 4.8.4         | 4.8.4       | 7.0.2           |
| wasm-opt (npm wrapper)      | 1.4.0         | —           | 1.4.0           |
| wasm-pack (npm wrapper)     | 0.12.1        | —           | 0.15.0          |
| base64-js                   | —             | 1.5.1       | 1.5.1           |
| @rollup/plugin-commonjs     | —             | 23.0.2      | 29.0.3          |
| @rollup/plugin-node-resolve | —             | 15.0.1      | 16.0.3          |
| @rollup/plugin-typescript   | —             | 9.0.2       | 12.3.0          |
| @rollup/plugin-terser       | —             | 0.1.0       | 1.0.0           |
| @types/jest                 | —             | 29.2.1      | 30.0.0          |
| jest                        | —             | 29.2.2      | 30.5.2          |
| rimraf                      | —             | 3.0.2       | 6.1.3           |
| rollup                      | —             | 3.2.5       | 4.64.0          |
| rollup-plugin-base64        | —             | 1.0.1       | 1.0.1           |
| rollup-plugin-copy          | —             | 3.4.0       | 3.5.0           |
| rollup-plugin-filesize      | —             | 9.1.2       | 10.0.0          |
| ts-jest                     | —             | 29.0.3      | 29.4.14         |
| tslib                       | —             | 2.4.1       | 2.8.1           |

`wasm-pack` and `wasm-opt` npm postinstall downloaders were deliberately skipped. The build commands call the official native tools through the explicit PATH, avoiding npm scripts that prepend the older wrappers' `node_modules/.bin`. Compat Rollup plugins are the upstream locked versions; they are not replaced by global/latest packages.

## Rust dependency classifications

Relevant resolutions below were read from the generated `bindings/typescript/Cargo.lock` and root `Cargo.lock` (both format 4). These ignored files now exist; retain them locally to repeat the scoped build. All listed external versions come from crates.io; Rapier and the generated binding crate use local workspace/path sources. Lockfile presence does not prove an optional feature was enabled or that dev dependencies were tested. Do not run `cargo update` to upgrade unrelated dependencies.

| Class / owning manifest                              | Retained upstream requirements                                                                                             | Relevant resolved versions                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine baseline, root workspace and binding template | rapier3d `0.36.0` via local path patch; bindings crate version `0.21.0`; engine Rust minimum `1.86`, edition `2024`        | rapier3d `0.36.0`; dimforge_rapier3d `0.21.0`                                                                                                       |
| Engine math/geometry                                 | nalgebra `0.35`, glamx `0.3.1`, simba `0.10.2`, parry3d `0.31.1`, num-traits `0.2`, approx `0.5`                           | nalgebra `0.35.0`, glamx `0.3.1`, simba `0.10.2`, parry3d `0.31.1`, num-traits `0.2.19`, approx `0.5.1`                                             |
| Engine utilities                                     | arrayvec `0.7`, bitflags `2`, log `0.4`, thiserror `2`, profiling `1.0`, static_assertions `1`, wide `1`                   | arrayvec `0.7.8`, bitflags `2.13.2`, log `0.4.34`, thiserror `2.0.21`, profiling `1.0.18`, static_assertions `1.1.0`, wide `1.7.1`                  |
| Optional engine dependencies                         | web-time `1.1` (profiler), rayon `1` (parallel), serde `1` (serialization), bytemuck `1` (layout support)                  | web-time `1.1.0`, serde `1.0.229`, bytemuck `1.25.2`; rayon `1.12.0` in root lock only                                                              |
| Binding template dependencies                        | parry3d `0.31`, ref-cast `1`, wasm-bindgen `0.2.109`, js-sys `0.3`, nalgebra `0.35`, serde `1`, bincode `1`, palette `0.7` | parry3d `0.31.1`, ref-cast `1.0.27`, wasm-bindgen `0.2.129`, js-sys `0.3.106`, nalgebra `0.35.0`, serde `1.0.229`, bincode `1.3.3`, palette `0.7.7` |
| Generator-only dependencies                          | clap `4.5`, clap_derive `4.5`, tera `1.20`                                                                                 | clap `4.6.7`, clap_derive `4.6.7`, tera `1.20.1`                                                                                                    |
| Engine dev/test-only dependencies                    | bincode `1`, serde_json `1`, serde `1`, oorandom `11`                                                                      | bincode `1.3.3`, serde_json `1.0.151`, serde `1.0.229`; oorandom `11.1.5` in root lock only; no engine test suite run                               |
| Unselected workspace dependencies                    | Upstream testbeds, loaders, examples, Python/C/Bevy bindings and the root puffin_egui Git pin remain unchanged             | Not part of the validated build scope; no related toolchains or GUI packages installed                                                              |

The resolutions above are from the binding workspace unless marked root-only, with engine versions also matching the root lock. Other root-workspace versions such as arrayvec `0.5.2`, bitflags `1.3.2` and thiserror `1.0.69` belong to other dependency edges and do not replace the direct engine requirements shown here. The existing npm inventory records actual installed direct build packages; generated package metadata has no external `dependencies` field.

These are caret ranges unless a path/Git override is specified. The older compatibility lines are deliberately retained: bincode `1` versus registry stable `3.0.0`, and tera `1.20` versus `2.4.0`. The setup-time registry snapshots for nalgebra/glamx/simba/parry3d were `0.35.0`/`0.3.1`/`0.10.2`/`0.31.1`; the existing requirements already match those lines. wasm-bindgen `0.2.109` admits `0.2.129`, js-sys `0.3` admits `0.3.106`, and other requirements admit compatible patches without manifest edits. No runtime dependencies were mass-upgraded.

## Historical baseline build commands

The tester reported PASS for each build command below. They are retained for reproducing the same scoped baseline; this documentation update did not execute them. Generated package metadata, CJS/ESM initialization and World step/free smoke checks, and `npm pack --dry-run` also passed according to the compact report; no additional success logs were inspected.

Run serially in a fresh shell; the upstream Rust script cleans the shared TypeScript Cargo target directory. Its final package build uses the existing generator, not an alternative build system. Default variant selection still builds all upstream packages; `RAPIER_COMPAT_VARIANT=3d` scopes generation, Rollup and declaration repair to the 3D non-deterministic, non-SIMD variant. `WASM_PACK_MODE=no-install` prevents tool installation during validation.

```bash
set -e
export PATH="/opt/cargo/bin:/opt/wasm-tools/bin:/opt/binaryen/bin:$PATH"
cd /home/dan/code/rapier
cargo build -p rapier3d --lib
cd bindings/typescript
cargo run -p prepare_builds -- -d dim3 -f non-deterministic
cd rapier-compat
WASM_PACK_MODE=no-install sh ./build-rust.sh -d 3 -f non-deterministic
RAPIER_COMPAT_VARIANT=3d sh ./gen_src.sh
RAPIER_COMPAT_VARIANT=3d ./node_modules/.bin/rollup --config rollup.config.js --bundleConfigAsCjs
RAPIER_COMPAT_VARIANT=3d bash ./fix_raw_file.sh
```

The first command validates only the native engine library, not root default members. Cargo may resolve other root workspace manifests/Git metadata while doing so; it must not build their testbeds or bindings. The WASM build uses the repository's engine through `bindings/typescript/Cargo.toml` path patches. The upstream generated feature set includes `serde-serialize`, `debug-render`, `profiler` and `fem`; the port retains FEM to keep existing soft-body binding APIs compilable without an unrelated feature-gating rewrite. Root native optimization settings are retained; the initial separate binding workspace used its upstream release profile (`debug=false`, one codegen unit, stripping, no LTO); the completed port adds release LTO and explicit opt-level 3 while retaining wasm-opt `-O4` flags.

Initial generated locations (historical steps 1–2 inspection; the current package is regenerated at the same package path):

-   `target/debug/librapier3d.rlib`: native engine library.
-   `bindings/typescript/builds/rapier3d/`: generated Cargo manifest and templates, using binding version 0.21.0.
-   `bindings/typescript/target/wasm32-unknown-unknown/release/rapier_wasm3d.wasm`: compiled binding WASM. The Rust script cleaned the earlier generator executable from the shared target directory.
-   `bindings/typescript/rapier-compat/builds/3d/wasm-build/`: wasm-pack manifest and `rapier_wasm3d` JS, declarations and WASM.
-   `bindings/typescript/rapier-compat/gen3d/` and `builds/3d/gen3d/`: preprocessed compat TypeScript sources.
-   `bindings/typescript/rapier-compat/builds/3d/pkg/`: initially verified `@dimforge/rapier3d-compat@0.21.0` manifest, README, license and `dist/` bundles (`rapier.mjs`, `rapier.cjs`, declarations including `rapier.d.ts`/`raw.d.ts`, maps and WASM). The initial package dry-run reported 54 files; no actual tarball was produced then. This path now contains the validated Chargeuk package recorded above.

At this initial baseline, steps 1–2 setup and scoped validation were complete. The merge was committed; setup code and documentation remained uncommitted for parent review. Scoped port regression coverage was subsequent work, now completed above; KaDshow integration, browser/performance proof and iPhone testing remain later work. These historical smoke results alone did not prove the port.

## Historical merge decisions and deferred fork work

Merge commit `1dd6615e` joins documentation commit `77180ebf` and upstream `846c463e`. Six conflicts were inspected and resolved before the subsequent scoped build validation summarized above. `AGENTS.md` and the original ten plan steps are preserved.

-   `InteractionGroups`: retain `belongs_to_with_grouping`, `collides_with_with_grouping`, `belongs_to_grouping` and the same-group bilateral predicate. Keep upstream `test_and`/`test_or` unchanged; `test()` combines upstream mode selection (And wins mixed modes) with the additional predicate. Existing upstream broad/narrow paths already call this shared function.
-   Constructor/default adaptation: retain upstream three-argument `new` for native/binding call sites; initialize additional fields to `u32::MAX` so existing upstream callers are neutral. `none()` retains zero custom values. Upstream `Default` membership is `GROUP_1` (the old fork used all groups); retain that upstream default while collider defaults still explicitly use `all()`. No JS custom setter or descriptor API was added during the initial merge; both are now ported.
-   `src/geometry/narrow_phase.rs`: remove the obsolete file and use upstream `narrow_phase/intersections.rs` and `pair_update.rs`. Restore upstream filters only when their `ActiveHooks` flags are enabled; default inactive hooks do not invoke callbacks. The old unconditional removal of contact/intersection hooks is not carried blindly into the new architecture; any needed removal requires step-3 evidence.
-   Profiles/examples: retain root release LTO/one-codegen-unit/optimization and per-engine dev settings. Drop old crate-local release profile copies (ignored by Cargo workspaces). Keep upstream example constructors; neutral custom defaults replace their old explicit max masks.
-   Initially deferred to steps 3–6: mask invalidation/pair rediscovery proof, collision/solver-group separation (both still use `InteractionGroups::test`), serialization/layout compatibility, custom group bindings, revolute/anchor/resize behaviour and meaningful regression coverage. At that merge point, steps 7–10, branding, FEM assessment and old-JS ports were unstarted. The current scoped port and retained FEM decision are recorded below; steps 8–10 remain unstarted.

## Current port mapping and scope

Reference: read-only `/home/dan/code/rapier.js` develop `aaf7c5a` compared with
matching upstream release `46992172b60d04034e0fa040153ddd50e18e6ef0` (v0.11.2,
second parent of `58f8eb4`), not today's upstream master.

| Old fork change                                                                                                                    | Combined-repository treatment                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native custom grouping fields/predicate                                                                                            | Already retained by merge; broad phase and contact/sensor narrow phases call `InteractionGroups::test`. Preserve And/Or rules and existing GROUPS-triggered stationary leaf reinsertion. Added behavioral tests, no production filtering rewrite.                                                     |
| `Collider.setDetailedCollisionGroups`, three `ColliderDesc` fields/defaults/fluent setters                                         | Ported in `src.ts/geometry/collider.ts`; current raw `coSetDetailedCollisionGroups` builds detailed groups and calls native `set_collision_groups`.                                                                                                                                                   |
| Three extra raw creation arguments in all old variants                                                                             | Translated internally: current high-level collider creation applies descriptor masks/ID through the detailed setter before exposing the collider or stepping. Existing 2D/3D/deformable raw creation signatures and standard callers remain intact.                                                   |
| Basic vs detailed unpack; query/character-controller call-site changes                                                             | Keep current standard `unpack_interaction_groups` with neutral MAX values; add separate detailed unpack. Current query/controller/solver callers already use the neutral path, so no mechanical renames or extra custom query API.                                                                    |
| Standard collision setter reset                                                                                                    | Preserved: standard setter uses neutral unpack and resets all custom values/ID; descriptor standard setter continues to change only standard bits, as in old fork.                                                                                                                                    |
| Old TS solver setter calls collision setter; detailed raw solver arguments                                                         | Bug deliberately not ported. Keep the current standard `coSetSolverGroups` signature and neutral solver unpacking; no new custom solver API. Regressions verify unchanged collision groups/custom masks and retained contacts with solver filtering.                                                  |
| Revolute limits during creation                                                                                                    | Ported for 2D and shared-axis 3D; also apply enabled limits to new upstream independent-axis 3D path. Disabled limits remain disabled, anchors/axis normalization stay upstream.                                                                                                                      |
| Joint anchors, limit updates, collider radius/half-height changes                                                                  | Already supported by current upstream APIs; add behavior coverage instead of duplicates.                                                                                                                                                                                                              |
| `@chargeuk` namespace/crate renames and package generation                                                                         | Brand only selected 3D compat package as `@chargeuk/rapier3d-compat@0.21.0-chargeuk.1`; CJS/ESM/types exports retained, fork repository/public publish metadata added, upstream author/license retained. Internal crate and `rapier_wasm3d` identifiers and binding version `0.21.0` remain upstream. |
| LTO/opt-level 3 and wasm-opt -O4/--dce                                                                                             | Enable valid binding workspace release LTO/opt-level 3; retain codegen-units=1/stripping and wasm-opt flags. No obsolete `[release]` table or ignored crate-local profile copies.                                                                                                                     |
| Old build-script machine paths, remove/add node_modules instructions, extra locks, whitespace-only capsule getter and demo changes | Not copied. Current scoped no-install generator/build scripts replace them; locked dependencies unchanged, no demo/testbed edits.                                                                                                                                                                     |
| Explicit old wasm-bindgen release debug/demangle settings                                                                          | Already match [wasm-pack 0.15.0 release defaults](https://github.com/wasm-bindgen/wasm-pack/blob/v0.15.0/src/manifest/mod.rs): debug JS glue off, demangling on, DWARF off; no redundant config copied.                                                                                               |
| Old unconditional physics-hook removals                                                                                            | Keep upstream ActiveHooks opt-in contract; native regressions cover inactive/enabled hooks and custom-filter precedence.                                                                                                                                                                              |

Non-deterministic/non-SIMD 3D remains the selected WASM variant. Existing FEM is
retained because current binding modules expose soft bodies; removing it would
need feature-gating work beyond this port. No dependency/tool installations,
engine/bindings version increases, unrelated cleanup, KaDshow/old-JS edits or
integration occurred. Package publication and steps 8–10 are not started.

### TypeScript 4.x declaration compatibility

wasm-bindgen 0.2.129 emits `[Symbol.dispose](): void;` methods, while
[TypeScript introduced `Symbol.dispose` in 5.2](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html).
KaDshow uses TypeScript 4.9 and this package's locked compiler is 4.8. The existing
declaration repair removes only those exact method declaration lines from the
selected `3d` package's `dist/rapier_wasm3d.d.ts`. Manual `free()` declarations,
all other types and JS/WASM runtime behavior (including runtime symbol disposal)
remain unchanged. Other variants are untouched. This intentionally omits automatic
disposal typings for TS 4.x without shims, global type changes or `skipLibCheck`;
the strict packed-package consumer remains the primary regression check.

To recheck declaration-only changes, use these commands from
`bindings/typescript/rapier-compat` (no new WASM/Rollup build):

```bash
RAPIER_COMPAT_VARIANT=3d bash ./fix_raw_file.sh
node tests/package-contract.cjs
```

## Repeatable scoped port proof commands

Use `exec_command` with `login: false` to preserve the image PATH. Required image
tools are `/opt/cargo/bin`, `/opt/wasm-tools/bin` and `/opt/binaryen/bin`, with
`RUSTUP_HOME=/opt/rustup` and `CARGO_HOME=/opt/cargo`; Node stays at the container's
22.21.1. The explicit PATH prefix below is command-session scoped. Verify paths
before diagnosing missing tools; do not install or substitute HOME tools.

```bash
set -e
export PATH="/opt/cargo/bin:/opt/wasm-tools/bin:/opt/binaryen/bin:$PATH"
cd /home/dan/code/rapier
cargo test --locked -p rapier3d --lib --test detailed_collision_groups
cd bindings/typescript
cargo run -p prepare_builds -- -d dim3 -f non-deterministic
cargo test --locked -p dimforge_rapier3d --lib
cd rapier-compat
WASM_PACK_MODE=no-install sh ./build-rust.sh -d 3 -f non-deterministic
RAPIER_COMPAT_VARIANT=3d sh ./gen_src.sh
RAPIER_COMPAT_VARIANT=3d ./node_modules/.bin/rollup --config rollup.config.js --bundleConfigAsCjs
RAPIER_COMPAT_VARIANT=3d bash ./fix_raw_file.sh
./node_modules/.bin/jest --runInBand --runTestsByPath tests/Chargeuk3d.test.ts
node tests/package-contract.cjs
```

Run serially: the WASM script cleans the shared binding Cargo target. These
commands avoid unrelated native/testbed/2D builds and old Jest tests which import
unbuilt deterministic variants. The 2D limit implementation is updated for source
consistency but a 2D WASM build/suite is not requested or claimed here.

Native tests cover standard/custom groups, stationary contact/sensor transitions,
solver flags and ActiveHooks. Binding Rust tests cover neutral/detailed unpacking
and enabled/disabled creation limits with distinct normalized axes. The focused
Jest file covers descriptor defaults/propagation, setters, stationary rediscovery,
solver independence, neutral ray queries, creation/update limits, anchors and
resizing. `package-contract.cjs` packs the actual regenerated package into
`/tmp/rapier-chargeuk-package-*`, verifies contents/metadata, extracts a disposable
consumer and checks actual CJS/ESM package exports, init/World step/free and
TypeScript declarations using the existing locked compiler and the compat tsconfig's ESM/node module resolution. Its compact JSON
reports tarball/unpacked/WASM sizes and retained artifact path. It writes no
repository source or config and uses no new dependencies.

The parent accepted completed scoped proof above. KaDshow regressions are deferred
with integration in step 8; browser/performance comparison and manual iPhone proof
remain unstarted. No 2D/SIMD proof, publication, commit or push is claimed.

## Bounded validation repairs and upstream quirks

-   One unchanged upstream `shape.rs` unit call lacked the third convex decomposition
    argument. Passing default flags `0` fixed compilation while preserving the
    degenerate-mesh None assertion; no production shape behavior changed.
-   Upstream `set_active_hooks` only assigns flags and does not dirty existing
    stationary pairs. The hook regression uses separate fresh inactive/enabled
    worlds, opts in before first step, and proves custom-mask precedence and
    rediscovery. The native setter is unchanged.
-   Native `GenericJoint.local_axis1/2` uses Pose _ Vector::X, a point transform
    including the anchor translation. Tests with nonzero anchors assert the actual
    local frame rotation _ Vector::X. Native getters are unchanged; the JS frameX
    path already reads rotation directly.
-   Upstream JS `ActiveCollisionTypes.ALL` omits FIXED_FIXED. Parentless fixtures
    explicitly enable FIXED_FIXED, retaining real contact/sensor assertions. The
    production enum is unchanged.
-   The source checker initially used edition 2024 for binding files; rerunning with
    their actual edition 2018 and skip_children=true passed. This configuration
    correction required no source changes.
-   Generated Symbol.dispose typings needed the intentional TS 4.x declaration
    translation above. Packed strict TS 4.8 proof now passes; manual free() and
    JS/WASM runtime code are preserved without compiler/dependency upgrades.
