# Feature notes

One note per roadmap feature, filed as `<slug>.md`. Written in this order, and the **Design**
section is written *before* the code:

- **Need** — what someone should be able to do on screen after this feature, and why it's next.
- **Design** — the smallest thing that does it. If it turns out to need a lower-level piece, that
  piece is built inside this same feature and only as big as the feature needs.
- **On screen** — what was verified in Chrome Canary (flag on), with the screenshot.

Architecture decisions still go in [`decisions/`](../decisions/) when there's a real fork in the
road; surprises go in [`engineering-notes/`](../engineering-notes/).
