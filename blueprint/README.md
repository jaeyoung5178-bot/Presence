# Presence Blueprint

Private, editable team-to-company workspace at `/blueprint/`. The hub's existing authorized Browse menu and search link here.

## Data and access

- Uses the existing active workbook account and Firebase auth-session mapping.
- Stores a versioned JSON document only at `userPreferences/<workbookUid>/presenceBlueprint` under the existing own-account rules. No new public collection or permission change.
- The published source contains generic proposals and blank metrics. Actual founder answers and promotion details must be imported into the founder's private account, never committed to this repository.
- `?demo=1` opens a blank, isolated preview. Preview changes never reach Firebase.
- Saves require server acknowledgment; revision transactions reject stale writes. A per-account tab draft supports reload recovery. Account changes clear the visible document.
- Share preview defaults to identity and values. Metrics, promotion, company notes, and dialogue require explicit selection. Copy/download does not publish a team document.
- Full JSON backup and import are available. Import replaces the screen draft only; account save is separate.

## Content conventions

Annual headcount targets are distinct from promotion requirements. Counts can include one another and are never summed automatically. Unknown counts, dates, and official requirements remain unknown. Frameworks, chant options, and logo concepts are proposals until marked decided. The original sector-leader POWER framework retains Positive Mindset, Operations, Work Ethic, Execution, and Resilience; suggested behavioral descriptions are new drafts.

## Validation

Run `node --test blueprint/model.test.mjs`, `node scripts/qa-blueprint-edge.cjs`, and `node scripts/qa-blueprint.cjs` with a local server on port 4197. The browser scripts use local Chrome and Playwright paths configured for the current workspace. Override `BLUEPRINT_QA_URL` and `BLUEPRINT_QA_OUTPUT` for the deployed repeat and output location.

Browser fixtures replace the Firebase SDK and do not write production data. They cover member/leader/admin at 390×844, 1024×768, and 1440×900; hub entry access; save/restore, failure, conflict, offline and account-change behavior; preview isolation; import validation; form focus above the fixed save bar; and share scope omissions. Fixture checks validate client behavior, not a replacement for server security rules.

Logo asset generation details are recorded in `ASSET-PROMPTS.txt`. The five logo plates remain exploratory concepts.
