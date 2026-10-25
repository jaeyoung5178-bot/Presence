# Presence Networking

Daily networking journal reached from the hub's Learning & Archive menu. My records is the default; team records use a separate visual treatment, member filters and grouped cards. Records have stable `#record/<id>` routes.

All records and original image data are stored in IndexedDB (`presence-networking-v1`, `records`) on the current browser and device. No record or photo is uploaded. Existing hub localStorage flags do not constitute protected server authentication. Callback's Firebase session and document permissions are specific to callback sheets; networking does not reuse those paths or upload private conversations to a public database.

JSON backups include photos and captures. Import checks format/version, record fields and safe raster data URIs. Duplicate record IDs keep the current device's record. Import runs in one transaction. Back up before clearing browser storage or changing devices. Record links require the same local record or an imported backup.

Generated artwork: built-in `image_gen`, premium tactile 3D clay editorial still life with interlocking sage/lavender conversation bubbles, cream photo album, tiny peach location pin and date card; matte ceramic; transparent; no text. Original: `/Users/jaeyoung5178/.codex/generated_images/01a17381-dee2-7702-a073-5758db3d6891/exec-2c3a2137-b103-4a61-9e2d-41f3663b1975.png`. Web assets: `assets/networking-connections.webp` and `assets/networking-icon.webp`. `assets/networking.svg` is an original code-authored illustration.

QA: `scripts/qa-networking.mjs` covers 390×844, 1024×768 and 1440×900, CRUD, separate scopes, image attachment, persistence, backup and restore. Run on a local static server; repeat on deployment before reporting completion.
