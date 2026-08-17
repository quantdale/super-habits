# Validation Notes

This spec package was authored directly on GitHub `main` before implementation.

The implementation agent is responsible for running the repository validators against the freshly pulled package before source-code changes. If OpenSpec or ExecPlan validation reports a structural issue in these authored artifacts, repair the spec package first, commit/push that repair to `main`, and then proceed with implementation.

Do not treat spec-authoring CI as a substitute for the implementation change's final validation. Final completion still requires the exact implementation SHA to pass both GitHub Actions `quality` and `e2e`.
