# EarthDex Taiwan BioCLIP recognition

## Architecture and provenance

Frozen biological image encoder: [BioCLIP](https://huggingface.co/imageomics/bioclip), ViT-B/16, Imageomics Institute, Stevens et al., CVPR 2024. This project does not claim to have trained BioCLIP.

The browser uses the MIT-licensed [Trail Bingo BioCLIP image encoder export](https://huggingface.co/jsteinshouer/trail-bingo-bioclip-onnx), pinned to `25d50dd481d6a748ce78c8bc513a420bf7d3d279`. File `image_encoder_fp16.onnx` stores FP16 weights and casts them to FP32 for computation, avoiding unsupported integer convolution operations. Input `pixel_values`: float32 `[1,3,224,224]`; output `embeddings`: normalized float32 `[1,512]`. ONNX Runtime Web 1.22.0 is loaded from version-pinned jsDelivr. The 172,899,543-byte file (approximately 165 MiB) is cached with a new cache namespace; the incompatible old int8 cache is removed. Model configuration is fetched with `no-store` so a stale cached config cannot select the old model.

The former int8 export failed under the web WASM provider at `ConvInteger(10)` even though it worked under Python's native CPU provider. This was reproduced using the exact web runtime package. `npm run test:wasm` now creates a session and executes a real turtle-photo tensor on the web WASM provider, validates its 512-dimensional output, and checks the complete species ranking. The report in `wasm-recognition-check.json` identifies the host as Node executing browser WASM; it does not claim full camera/browser UI testing.

Text prototypes are precomputed in development with the MIT-licensed [Trail Bingo BioCLIP text encoder export](https://huggingface.co/jsteinshouer/trail-bingo-bioclip-onnx), pinned to `25d50dd481d6a748ce78c8bc513a420bf7d3d279`. Species common/scientific name prompts are embedded and averaged, then normalized. The browser does not download the text encoder.

EarthDex's own classifier combines nearest-reference image similarity and species-name similarity (`0.55 * image + 0.45 * 2 * text`). The ranking implementation is shared and unit tested. These are scores, not calibrated posterior probabilities.

## Data

Reference photographs are public Wikimedia Commons images with author, license and file source retained in the reference bank. No private user photographs are used to build/train the classifier. Diagrams, range maps, dentition images, and duplicate file names are excluded from the classifier. The small initial set is not exhaustive and needs further expert curation. Primary gallery image provenance is displayed in-app.

The development scripts build the reference set and text prototypes, compute feature vectors, and save an evaluation report. Local weight caches and image working files are ignored by Git; reproducible code, pinned metadata, reference vectors and public attribution are tracked.

## Evaluation boundaries

`recognition-evaluation.json` records the concrete current counts. For taxa with more than one unique reference, the last reference is held out; it is not included among the reference vectors used for that evaluation. This small check tests the complete feature/ranking path. Text-name prototypes remain available in evaluation and production. The production classifier subsequently uses all curated references.

The existing score threshold and top-two margin come from a small development calibration set, not an independent field benchmark. Low scores, small margins, and unsupported preferred text labels now yield `uncertain` while retaining the top three candidate scores. Following the latest user instruction, the server selects the highest AI candidate and immediately offers its field quiz, including low-confidence results. A correct answer issues a game card; there is no human-review workflow or configured reviewer. This supersedes the initial mandatory review requirement. High similarity is never an expert identification or a calibrated probability.

`npm run test:wasm` executes a licensed turtle image and five additional scenarios: real forest, synthetic gray, synthetic blurred turtle, synthetic multiple-animal collage, and a licensed African elephant outside the supported catalog. Source/license metadata is retained in `docs/evidence/recognition-unknown-source.json`; reports are in `recognition-scenarios.json`. These tests demonstrate candidate scoring, wrong-answer retries and correct-answer game collection for each scenario. They do not establish blur, multiple-animal or unknown-species rejection. Such images can receive incorrect top candidates and game cards after a correct quiz answer under the requested policy. Cards and AI observations never count as scientific verification. Owner scoping, forged species claims, quiz versions and exact-photo grant deduplication are separately tested.

## Runtime, privacy and integrity

Image preprocessing resizes the shortest edge to 224, center-crops 224×224, converts to RGB, rescales and normalizes with CLIP mean/std. Browser canvas resampling and Pillow bicubic may differ slightly; this cross-runtime interpolation difference has not been quantified because the shared browser is unavailable in this environment.

Device inference keeps photos away from third-party model providers. Downloading the runtime and weights still requires outbound access to their CDNs. A user's submitted observation photo and 512-dimensional feature vector go to EarthDex's authenticated API. Photos and opt-in GPS are private user-scoped records; shared projections suppress precise GPS and all sensitive-species coordinates. No player photo is sent to a third-party citizen-science platform.

The server recomputes ranking, validates image type/signature/size, hashes the photo for same-file duplicates, and scopes all records to the platform user. It does not cryptographically prove that a client feature vector came from the submitted image. Client-submitted features are not proof of photo content or field authenticity; the server ranks them, but there is no human confirmation in the requested flow. Species can be misclassified; operational moderation, real mobile QA and stronger anti-cheat still need work.
