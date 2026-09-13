# PHASE RANK: independent run records

Both games now accept every qualifying run, including multiple records from the same person or nickname. Each run asks for a nickname. The top ten entries are ordered by score descending and registration time ascending; names, device identity, Newton's gem count and distance do not break ties.

New document IDs are `{Firebase Auth UID}_{run UUID}` in the existing collections:
- Newton: `newtonScores/{recordId}`
- Faraday normal/easy: `faradayScores/{difficulty}/players/{recordId}`

Existing UID-keyed records remain visible and unchanged. Legacy create/update rules remain available for cached older clients. New run records are create-only: a transaction reads its deterministic ID and returns the existing entry on a retry, so a double submit does not duplicate one play. Client qualification includes all existing entries, including those owned by the current user. A lower score than a previous personal best can qualify.

The Firebase rule file is `newton-rush.firestore.rules`. It retains field validation and owner-only writes. Faraday retains owner cleanup; Newton deletion remains disabled. No authentication account or pre-existing record is removed.

The `newtonScores` index on `score DESC, updatedAt ASC` is added alongside the original index. `faraday.indexes.json` contains the Faraday, new Newton and legacy Newton index definitions; existing indexes are not removed.

Verification:
- `tools/faraday-ranking.test.cjs` exercises both real ranking interfaces against local Firebase doubles: one player and one nickname can fill all ten entries, another person can reuse the same name, a lower personal score can qualify, a tied tenth score cannot displace the older record, the cutoff is rechecked on save, and one run cannot be submitted twice.
- Shared Firebase reads and Faraday temporary-record checks are separate from those isolated tests.
- Run `node tools/ranking-register.cjs`, regenerate the two game previews, and verify the catalog before publishing.

API references: [Firestore rules string matching](https://firebase.google.com/docs/reference/rules/rules.String), [transactions](https://firebase.google.com/docs/firestore/manage-data/transactions), [composite indexes](https://firebase.google.com/docs/firestore/query-data/index-overview).
