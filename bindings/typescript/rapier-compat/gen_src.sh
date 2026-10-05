# Copy source and remove #if sections - similar to script in ../rapierXd
set -e

# Leave the upstream six-variant build unchanged unless a scoped build is requested.
case "${RAPIER_COMPAT_VARIANT:-all}" in
  all) dimensions="2d 3d"; variants="2d 2d-deterministic 2d-simd 3d 3d-deterministic 3d-simd" ;;
  3d) dimensions="3d"; variants="3d" ;;
  *) echo "Unsupported RAPIER_COMPAT_VARIANT: $RAPIER_COMPAT_VARIANT" >&2; exit 1 ;;
esac

gen_js() {
  DIM=$1
  GENOUT="./gen${DIM}"

  # Make output directories
  mkdir -p ${GENOUT}

  # Copy common sources
  cp -r ../src.ts/* $GENOUT

  # Copy compat mode override sources
  rm -f "${GENOUT}/raw.ts" "${GENOUT}/init.ts"
  cp -r ./src${DIM}/* $GENOUT
}

for dim in $dimensions; do
  gen_js "$dim"
  if [ "$dim" = "2d" ]; then
    excluded="DIM3"
  else
    excluded="DIM2"
  fi
  # See https://serverfault.com/a/137848
  find "gen${dim}/" -type f -print0 | LC_ALL=C xargs -0 sed -i.bak "\\:#if ${excluded}:,\\:#endif:d"
  find "gen${dim}/" -type f -name '*.bak' -delete
done

for feature in $variants; do
  dim="${feature%%-*}"
  dimension="${dim%d}"

  pkg_dir="./builds/${feature}/pkg"
  dist_dir="${pkg_dir}/dist"

  mkdir -p "${dist_dir}"

  cp ./builds/${feature}/wasm-build/rapier_wasm* "${dist_dir}/"
  cp -r "./gen${dimension}d" "./builds/${feature}/"

  # copy tsconfig, as they contain paths
  cp ./tsconfig.common.json ./tsconfig.json "./builds/${feature}/"
  cp "./tsconfig.pkg${dimension}d.json" "./builds/${feature}/tsconfig.pkg.json"

  # "import.meta" causes Babel to choke, but the code path is never taken so just remove it.
  sed -i.bak 's/import.meta.url/"<deleted>"/g' "${dist_dir}/rapier_wasm${dimension}d.js"

  # Clean up backup files.
  find "${dist_dir}" -type f -name '*.bak' -delete

done
