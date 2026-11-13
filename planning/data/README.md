# Price Studio shared document

The main branch is the shared store. price-studio-project.json preserves all editable prices, styles, layout, transforms and embedded logo. price-studio-prices.csv mirrors the prices and labels. The editor reads the latest main-branch document through the GitHub API, independent of the Pages URL query string.

Each editing device connects a repository-scoped GitHub fine-grained token with Contents read/write using the GitHub storage dialog. Tokens are never stored in this repository. Session storage is used by default; persistent storage is opt-in.

Writes use the document blob SHA as a compare-and-swap version. Conflicts stop automatic writes until the user explicitly chooses a document. Local unsent edits survive reload. Before loading a remote document, the local document is backed up under mongle-price-studio-v2-before-github.

Initial shared snapshot: owner's 2026-11-13 image.
