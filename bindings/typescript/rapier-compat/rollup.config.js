import commonjs from "@rollup/plugin-commonjs";
import {nodeResolve} from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import path from "path";
import {base64} from "rollup-plugin-base64";
import copy from "rollup-plugin-copy";
import filesize from "rollup-plugin-filesize";

const config = (dim, features_postfix) => {
    const pkgDir = `builds/${features_postfix}/pkg`;
    const distDir = `${pkgDir}/dist`;
    return {
        input: `builds/${features_postfix}/gen${dim}/rapier.ts`,
        output: [
            {
                file: `${distDir}/rapier.mjs`,
                format: "es",
                sourcemap: true,
                exports: "named",
            },
            {
                file: `${distDir}/rapier.cjs`,
                format: "cjs",
                sourcemap: true,
                exports: "named",
            },
        ],
        plugins: [
            copy({
                targets: [
                    {
                        src: `builds/${features_postfix}/wasm-build/package.json`,
                        dest: pkgDir,
                        transform(content) {
                            let config = JSON.parse(content.toString());
                            config.name = `@dimforge/rapier${features_postfix}-compat`;
                            if (features_postfix === "3d") {
                                config.name = "@chargeuk/rapier3d-compat";
                                config.version = "0.21.0-chargeuk.3";
                                config.repository = {
                                    type: "git",
                                    url: "git+https://github.com/Chargeuk/rapier.git",
                                };
                                config.description += " Chargeuk KaDshow fork.";
                                config.publishConfig = {access: "public"};
                                delete config.private;
                            }
                            config.description +=
                                " Compatibility package with inlined webassembly as base64.";
                            config.types = "dist/rapier.d.ts";
                            config.main = "dist/rapier.cjs";
                            config.module = "dist/rapier.mjs";
                            config.exports = {
                                ".": {
                                    types: "./dist/rapier.d.ts",
                                    require: "./dist/rapier.cjs",
                                    import: "./dist/rapier.mjs",
                                },
                            };
                            if (features_postfix === "3d") {
                                config.exports["./web"] = {
                                    types: "./web/rapier.d.ts",
                                    import: "./web/rapier.mjs",
                                    default: "./web/rapier.mjs",
                                };
                                // Locked TS 4.8 consumers also use node resolution.
                                config.typesVersions = {
                                    "*": {web: ["web/rapier.d.ts"]},
                                };
                                config.description +=
                                    " External-WASM web entry available.";
                            }
                            // delete config.module;
                            config.files = ["dist"];
                            if (features_postfix === "3d")
                                config.files.push("web");
                            // The base manifest's `sideEffects: ["./*.js"]` matches
                            // nothing (the bundles are .cjs/.mjs), which bundlers already
                            // treat as "no side effects"; say so explicitly.
                            config.sideEffects = false;
                            return JSON.stringify(config, undefined, 2);
                        },
                    },
                    {
                        src: `../builds/rapier${features_postfix}/LICENSE`,
                        dest: pkgDir,
                    },
                    {
                        src: `../builds/rapier${features_postfix}/README.md`,
                        dest: pkgDir,
                    },
                ],
            }),
            base64({include: "**/*.wasm"}),
            terser(),
            nodeResolve(),
            commonjs(),
            typescript({
                tsconfig: path.resolve(
                    __dirname,
                    `builds/${features_postfix}/tsconfig.pkg.json`,
                ),
                sourceMap: true,
                inlineSources: true,
            }),
            filesize(),
        ],
    };
};

const webConfig = {
    input: "builds/3d/gen3d-web/rapier.ts",
    output: {
        file: "builds/3d/pkg/web/rapier.mjs",
        format: "es",
        sourcemap: true,
        exports: "named",
    },
    plugins: [
        terser(),
        nodeResolve(),
        commonjs(),
        typescript({
            tsconfig: path.resolve(__dirname, "builds/3d/tsconfig.web.json"),
            sourceMap: true,
            inlineSources: true,
        }),
        filesize(),
    ],
};

const variant = process.env.RAPIER_COMPAT_VARIANT;
if (variant && variant !== "3d" && variant !== "all") {
    throw new Error(`Unsupported RAPIER_COMPAT_VARIANT: ${variant}`);
}

export default variant === "3d"
    ? [config("3d", "3d"), webConfig]
    : [
          config("2d", "2d"),
          config("2d", "2d-deterministic"),
          config("2d", "2d-simd"),
          config("3d", "3d"),
          config("3d", "3d-deterministic"),
          config("3d", "3d-simd"),
          webConfig,
      ];
