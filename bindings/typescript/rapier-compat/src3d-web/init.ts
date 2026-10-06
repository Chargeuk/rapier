import wasmInit from "../pkg/web/rapier_wasm3d";
import {InitInput} from "./raw";

let initialization: Promise<void> | undefined;

async function initialize(
    input?: InitInput | Promise<InitInput>,
): Promise<void> {
    let module = await input;
    if (module === undefined) {
        module = new URL("rapier_wasm3d_bg.wasm", import.meta.url);
    }
    if (
        typeof module === "string" ||
        (typeof Request === "function" && module instanceof Request) ||
        (typeof URL === "function" && module instanceof URL)
    ) {
        module = await fetch(module);
    }
    if (typeof Response === "function" && module instanceof Response) {
        if (!module.ok) {
            // Do not include URLs, which can contain credentials or query tokens.
            throw new Error(
                `Failed to fetch Rapier WASM (HTTP ${module.status}).`,
            );
        }
        const mime = module.headers.get("Content-Type");
        // Buffer fallback is limited to unsupported streaming or a wrong MIME
        // type. Fetch/compile/link errors retain their original rejection.
        module =
            mime === "application/wasm" &&
            typeof WebAssembly.compileStreaming === "function"
                ? await WebAssembly.compileStreaming(module)
                : await module.arrayBuffer();
    }
    await wasmInit({module_or_path: module});
}

/**
 * Initializes the web entry from its emitted WASM asset, or an explicit input.
 * Await before using any library methods. The first call owns initialization;
 * subsequent calls reuse its promise, including any loading failure.
 */
export function init(input?: InitInput | Promise<InitInput>): Promise<void> {
    if (initialization === undefined) {
        initialization = initialize(input);
    }
    return initialization;
}
