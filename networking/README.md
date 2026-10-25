# Presence Networking

Server-backed private networking archive reached from Learning & Archive in the hub. My records is the default; team records have a lavender treatment, member filters and grouped cards. Both scopes belong to the signed-in account. Stable `#record/<id>` links open on any device signed into the same account.

Uses existing workbook authentication from `recruiting/store.js`: Firebase device identity plus server-validated `authSessions` binding to an active workbook account. Hub localStorage flags are not authentication. Existing sessions restore automatically; another device signs in with the same workbook ID and password.

Private RTDB root: `userPreferences/<workbookUid>/networkingArchive`. Live security rules were read and verified on 2026-10-26: only a Firebase identity whose server authSessions userUid matches this active account can read/write the parent. No rules change or public database path is needed.

Each `records/<id>` document has JSON metadata, revision and operationId. REST ETag/If-Match compare-and-swap detects concurrent edits. A successful server response is required before showing saved. Ambiguous responses are checked against operationId; otherwise editor contents remain and the user is asked to verify server state. Deletions retain revisioned tombstones to prevent stale edits or imports resurrecting records.

Full images are separate private `photos/<photoId>` documents, read only as needed. Metadata contains immutable references and thumbnails under 40KB. Selections up to 15MB are supported. Data URIs up to 4MiB preserve the source, including long chat captures; larger images are resized/compressed or fail with a clear message. Maximum 40 images/captures per record. Images upload before metadata. Failed/ambiguous uploads are not cleaned up because a committed record may reference them. Removed images and deleted records disappear from the archive; unreferenced private blobs currently remain pending future reference-aware cleanup. The UI does not promise permanent physical image deletion.

Logout/account changes close subscriptions and clear record DOM, photo cache, editor and image state. There is no automatic offline queue: failed saves preserve the editor and clearly report that the server has not acknowledged the write.

Old IndexedDB (`presence-networking-v1`, `records`) data is inspected only for an explicit migration prompt. It is never automatically assigned or uploaded to an account. The user clicks “내 계정에 기존 기록 올리기” after checking the current account. Original local records remain. Existing server IDs, including tombstones, are skipped; interrupted migrations report partial progress and can be safely retried.

Version-1 JSON backups include all referenced full images. Import validates fields and safe raster data URIs, prepares images for the cloud limits, and creates records separately without overwriting existing IDs. Failures preserve source backups and existing server records. Backups are independent copies, not primary storage.

Generated artwork: built-in `image_gen`, premium tactile 3D clay editorial still life with interlocking sage/lavender conversation bubbles, cream photo album, tiny peach location pin and date card; matte ceramic; transparent; no text. Original: `/Users/jaeyoung5178/.codex/generated_images/01a17381-dee2-7702-a073-5758db3d6891/exec-2c3a2137-b103-4a61-9e2d-41f3663b1975.png`. Web assets: `assets/networking-connections.webp` and `assets/networking-icon.webp`. `assets/networking.svg` is an original code-authored illustration.

QA uses isolated Firebase/REST mocks, never production record mutations. Test at 390×844, 1024×768 and 1440×900. Cloud checks cover ETag conflicts, tombstones, response-loss reconciliation, account changes, photos and offline rejection. UI checks cover login, cross-device contexts, CRUD, attachments, account isolation, explicit migration and responsive layout. Repeat on deployment before reporting completion.
