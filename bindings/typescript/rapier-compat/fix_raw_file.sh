#!/bin/bash

set -e

case "${RAPIER_COMPAT_VARIANT:-all}" in
  all) variants="2d 2d-deterministic 2d-simd 3d 3d-deterministic 3d-simd" ;;
  3d) variants="3d" ;;
  *) echo "Unsupported RAPIER_COMPAT_VARIANT: $RAPIER_COMPAT_VARIANT" >&2; exit 1 ;;
esac

for feature in $variants
do

# The wasm-bindgen module is always named after the crate (rapier_wasm2d/rapier_wasm3d),
# whatever the feature variant (-deterministic/-simd) of the build.
dimension="${feature%%-*}"

echo "export * from \"./rapier_wasm${dimension}\";" > "builds/${feature}/pkg/dist/raw.d.ts"

# The fork's 3D package supports TS 4.x, which has no Symbol.dispose type.
# Remove only the generated automatic-disposal declaration; retain free() and runtime code.
if [ "$feature" = "3d" ]; then
    declarations="builds/${feature}/pkg/dist/rapier_wasm${dimension}.d.ts"
    sed -i.bak '/^[[:space:]]*\[Symbol\.dispose\](): void;[[:space:]]*$/d' "$declarations"
    rm -f "${declarations}.bak"
    echo 'export * from "./rapier_wasm3d";' > builds/3d/pkg/web/raw.d.ts
    declarations="builds/3d/pkg/web/rapier_wasm3d.d.ts"
    sed -i.bak '/^[[:space:]]*\[Symbol\.dispose\](): void;[[:space:]]*$/d' "$declarations"
    rm -f "${declarations}.bak"
fi

done;
