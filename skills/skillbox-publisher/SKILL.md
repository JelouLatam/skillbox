---
name: skillbox-publisher
description: Publish a new skill or an update to the Jelou Skills library, or propose a change for review. Use when the user asks to publish, upload, share, update or propose a skill, or to move a local skill folder into the shared library.
---

# Skillbox publisher

The library keeps every skill as immutable revisions. Every write names the revision it replaces, so two
people editing the same skill never overwrite each other silently.

## 1. Know what you can do

Look at the Skillbox MCP tools available in this session:

| Tool present | You can |
|---|---|
| `upsert_skill` | Publish directly (create and update). |
| `propose_skill_update` | Propose changes to an existing skill; an admin approves them. |
| Neither | Read only. Tell the user to ask an admin for author access (People page). |

New skills can only be created with `upsert_skill`. An author who wants a new skill should share the
folder with an admin, who publishes it.

## 2. Validate the folder before sending anything

- `SKILL.md` exists at the root with front matter containing `name` and `description`.
- `name` equals the skill id: lowercase letters, digits and hyphens, starting with a letter or digit, at
  most 80 characters.
- `description` says what the skill does **and** when to use it; agents choose skills from it.
- No secrets: search every file for tokens, API keys, passwords, cookies, `.env` content and private
  URLs with credentials. Stop and ask the user if you find any.
- No absolute paths from one machine (`/Users/...`, `C:\...`). Use paths relative to the skill folder.
- No symlinks, nothing over 2 MB per file, no `.git`, `node_modules` or `.env*`.
- Everything in English: names, descriptions, instructions and file names.

## 3. Get the current revision

- Call `search_skills` with the id. If it exists, call `load_skill` and keep the `revision` it returns.
- If it does not exist, the expected revision is `null` (MCP) or `new` (CLI).
- If the skill exists, compare the folder with the loaded files and show the user what changes. Every
  file you omit is removed from the new revision, so include unchanged files too.

## 4. Publish or propose

Write a message of at most 200 characters that says what changed and why.

**Publish** (`upsert_skill`): send `id`, `expectedRevision`, every file (`path`, base64 `content`,
`sha256`, `size`, `executable`) and the message. From a terminal the CLI builds the files for you:

```sh
skillbox publish ./my-skill my-skill <revision|new>
```

**Propose** (`propose_skill_update`): same files and `expectedRevision` (required), plus the message.
Check its status later with `list_skill_proposals`.

## 5. Handle conflicts

A "Skill changed" error means someone published after you loaded. Load again, reapply the user's change
on top of the new revision, show the difference, and retry. Never retry with a stale revision.

## 6. Confirm

Report the skill id, the new revision (or the proposal id), and what changed. Everyone connected to the
library gets the new revision on their next load; nobody needs to reinstall anything.
