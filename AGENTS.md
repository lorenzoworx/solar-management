# Working on Solar Management

This is a guided learning project for a CS graduate comfortable with the web stack. The learner wants to understand, explain, and contribute to the implementation.

## Checkpoint discipline

- Read README.md for current status and docs/roadmap.md for the agreed design.
- Build in tested, committed checkpoints. The learner has a time constraint and explicitly removed learning-review pauses.
- Continue implementation without waiting for exercise responses. Put all learning questions, exercises, and deferred user tasks in the root questions.md file.
- Keep explanations in the project documentation and give concise progress/results in chat.
- Do not invent exercise answers or mark learning review complete without the learner's responses.
- Keep README.md and the roadmap's checkpoint status current.
- Keep updates and explanations concise to conserve tokens. Prefer one useful explanation and one exercise over a detailed play-by-play.

## Implementation boundaries

- Rebuild in this repository; use the separate solar-dashboard project as a reference.
- Distinguish simulated readings, estimates, implemented features, and planned features.
- Use the agreed TypeScript/React/Express/PostgreSQL stack and direct parameterized SQL when implementation reaches those checkpoints.
- Test behavior and important failure modes at the checkpoint where they are introduced.
- Make small commits reflecting actual completed work. Do not manufacture earlier dates or a fictional development history.
- Keep secrets, local databases, backups, dependency folders, and build output out of Git.

Current checkpoint: 7. Checkpoints 1–6 are implemented and tested; container startup, HTTPS browser scenarios, restart persistence, and backup restoration pass in CI. Learning review remains deferred to questions.md; do not mark it complete without evidence. Public deployment requires the Mac mini connection and hostname/tunnel configuration recorded there.
