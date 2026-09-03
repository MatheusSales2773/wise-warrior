# Issue tracker: GitHub

Issues and PRDs for this repository live as GitHub issues in `MatheusSales2773/wise-warrior`. Use the `gh` CLI for all operations.

## Conventions

- Create an issue with `gh issue create --title "..." --body-file <file>`.
- Read an issue with `gh issue view <number> --comments` and include its labels.
- List issues with `gh issue list --state all --json number,title,body,labels,comments,url`.
- Comment with `gh issue comment <number> --body "..."`.
- Apply or remove labels with `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close with `gh issue close <number> --comment "..."`.

Infer the repository from `git remote -v` when working inside this clone.

## Skill terminology

When a skill says to publish to the issue tracker, create a GitHub issue. When it says to fetch a relevant ticket, read the complete GitHub issue and its comments.
