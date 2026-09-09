# Git & Version Control

- Prefers to keep git history clean and linear: favors fast-forward merges (`--ff-only`) to bring a branch up to date rather than merge commits or rebasing, when main is an ancestor. Confidence: 0.9
- Prefers the conventional, readable local-checkout approach (e.g. `git checkout main && git merge --ff-only gardeneel`) over clever remote-only commands when both produce the same result. Confidence: 0.8
- Recommends the safest option first and verifies branch divergence (ahead/behind, merge-base) before prescribing or running a git operation. Confidence: 0.9
- Leaves potentially impactful remote operations like `git push` to the user, offering to run the local work but deferring push unless asked. Confidence: 0.7
- When providing git commands for the user to run themselves, spells out exact, complete, copy-paste-ready syntax with correct remote and branch names — the user typo'd the branch name (`gardeneel`→`gradeneel`) and used wrong remote push syntax on their own, so precision matters. Confidence: 0.4