# Claude Code execution boundary

This repository uses a human-owned, reviewer-separated execution model.
These rules are loaded before work begins and apply to the main execution
session and every derived role.

## Before the first tool call

1. Read `PRINCIPLES.md` completely.
2. Read the current owner-approved handoff and work package completely.
3. Confirm the current role table: the owner decides, the execution session
   implements, and the independent reviewer judges.
4. Answer the task-start five questions from the available authority:
   what, for whom, which problem, based on which evidence, and what exact
   deliverable. Ask the owner only when an answer would materially change
   scope or authorization.
5. Verify the real Git state before relying on a conversation summary.

If any required authority is missing or inconsistent, stop and report. Do not
replace a governing source with a summary quoted by another file or session.

## Permanent execution controls

- G3-protected directories are never readable by an execution session. The
  restriction applies equally to derived roles and cannot be bypassed by
  delegation.
- Derived roles are disabled by default. Enabling them requires a later,
  owner-approved governance change; a session-level permission is not enough.
- Searches require an explicit, named scope. Bare recursive shell searches,
  repository-root search defaults, recursive enumeration, background tasks,
  and self-created probe or scratch repositories are prohibited.
- Do not create project evidence in temporary directories. Use only paths and
  write actions explicitly authorized by the current work package.
- A denial from the project governance hook is a stop condition. Do not retry
  the same action through a different tool or reconstructed command.
- Publishing, pushing, tagging, releasing, configuration changes, and other
  external writes require the current package’s explicit human trigger.

## Required full-response closeout

Every complete execution or audit report ends with these five sections:

1. 核心总结
2. 你现在要做什么
3. 做完这一步直接得到什么
4. 整个任务最终得到什么
5. 预期结果

Concise wording never permits omitted checks, weakened evidence, placeholders
inside required raw evidence, hidden uncertainty, or a missing stop report.
