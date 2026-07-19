/**
 * Project governance gate for Claude Code.
 *
 * Runtime:
 *   node validation/system/governance_gate.mjs --hook
 *   Reads one PreToolUse JSON object from stdin and exits 2 to block.
 *
 * Verification:
 *   node validation/system/governance_gate.mjs --self-test
 *   Validates the committed policy files and deterministic allow/deny cases.
 */

import { readFile } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FORBIDDEN_LEAF_NAMES = new Set(["raw", "private"]);
const PROTECTED_GOVERNANCE_PATHS = [
  "principles.md",
  "claude.md",
  ".claude/settings.json",
  "validation/system/governance_gate.mjs",
  "validation/system/run.js",
];

function normalize(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .toLowerCase();
}

function resolved(value, cwd = PROJECT_ROOT) {
  const text = String(value ?? "");
  return normalize(path.isAbsolute(text) ? path.resolve(text) : path.resolve(cwd, text));
}

function hasForbiddenSegments(value, cwd = PROJECT_ROOT) {
  const candidates = [normalize(value), resolved(value, cwd)];
  return candidates.some((candidate) => {
    const parts = candidate.split("/").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (parts[i] === "validation" && FORBIDDEN_LEAF_NAMES.has(parts[i + 1])) {
        return true;
      }
    }
    return false;
  });
}

function isProtectedGovernancePath(value, cwd = PROJECT_ROOT) {
  const candidate = resolved(value, cwd);
  return PROTECTED_GOVERNANCE_PATHS.some(
    (relative) => candidate === resolved(relative, PROJECT_ROOT)
  );
}

function isBroadSearchScope(value, cwd = PROJECT_ROOT) {
  if (!String(value ?? "").trim()) return true;
  const candidate = resolved(value, cwd);
  const root = resolved(PROJECT_ROOT, PROJECT_ROOT);
  const validationRoot = resolved("validation", PROJECT_ROOT);
  if (candidate === root || candidate === validationRoot) return true;
  if (candidate.startsWith(`${validationRoot}/`)) {
    try {
      return statSync(candidate).isDirectory();
    } catch {
      return path.extname(candidate) === "";
    }
  }
  return false;
}

function block(code, reason) {
  return { allowed: false, code, reason };
}

function allow() {
  return { allowed: true, code: "ALLOW", reason: "" };
}

function commandMentionsProtectedGovernancePath(command) {
  const text = normalize(command);
  return PROTECTED_GOVERNANCE_PATHS.some((relative) => text.includes(normalize(relative)));
}

function isWriteShapedCommand(command) {
  return /(?:^|[;&|]\s*)(?:rm|del|erase|mv|move|cp|copy|sed\s+-i|perl\s+-pi|apply_patch)\b|(?:^|\s)(?:>|>>)\s*\S|\b(?:set-content|add-content|out-file|remove-item|move-item|copy-item)\b/i.test(
    command
  );
}

const SQ = String.fromCharCode(39);
const DQ = String.fromCharCode(34);
const BS = String.fromCharCode(92);
const BT = String.fromCharCode(96);
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const TB = String.fromCharCode(9);
const RE_SEG = new RegExp("[;&|" + NL + CR + "]+");
const RE_WS = new RegExp("[ " + TB + NL + CR + "]+");
const RE_SHELL = new RegExp("^(?:sh|bash)$", "i");
const RE_NAMED = new RegExp("g8_scan", "i");
const RE_MODE = new RegExp("^[a-z]+$");
const EXPANSION = ["$", BT, "*", "?", "[", "]", "{", "}", "~", DQ, SQ, BS];
const APPROVED_SCAN_SCRIPT_PATH = resolved("../g8_scan.sh", PROJECT_ROOT);
const APPROVED_SCAN_MODES = ["tree", "head", "msg", "struct"];

function hasExpansion(token) {
  return EXPANSION.some((character) => token.indexOf(character) !== -1);
}

function endsSh(token) {
  return token.toLowerCase().endsWith(".sh");
}

function evaluateApprovedScriptArguments(command, cwd) {
  const base = cwd || PROJECT_ROOT;
  for (const segment of String(command ?? "").split(RE_SEG)) {
    const tokens = segment.trim().split(RE_WS).filter(Boolean);
    if (tokens.length === 0) continue;
    for (let i = 0; i !== tokens.length; i += 1) {
      if (!RE_SHELL.test(tokens[i])) continue;
      const target = tokens[i + 1];
      if (target === undefined || hasExpansion(target) || !endsSh(target)) {
        return block("G8_MODE_DENIED", "sh or bash must invoke a literal .sh path");
      }
    }
    const named = tokens.findIndex((token) => RE_NAMED.test(token));
    if (named === -1) continue;
    const lead = tokens.slice(0, named);
    if (lead.length !== 0 && !(lead.length === 1 && RE_SHELL.test(lead[0]))) {
      return block("G8_MODE_DENIED", "the approved scan script may only run directly or through sh/bash");
    }
    if (hasExpansion(tokens[named])) {
      return block("G8_MODE_DENIED", "the approved scan script path must be a bare literal");
    }
    if (resolved(tokens[named], base) !== APPROVED_SCAN_SCRIPT_PATH) {
      return block("G8_MODE_DENIED", "only the approved scan script at its registered path may run");
    }
    const args = tokens.slice(named + 1);
    if (args.length !== 1) {
      return block("G8_MODE_DENIED", "the approved scan script takes exactly one mode argument");
    }
    if (!RE_MODE.test(args[0]) || !APPROVED_SCAN_MODES.includes(args[0])) {
      return block("G8_MODE_DENIED", "the scan mode must be one literal word from the registered set");
    }
  }
  return null;
}

function evaluateBash(input, cwd) {
  const command = String(input.command ?? "");
  if (!command.trim()) return block("BASH_EMPTY", "Bash command must be non-empty");
  if (input.run_in_background === true) {
    return block("BACKGROUND_DENIED", "background tasks are disabled by project governance");
  }
  if (hasForbiddenSegments(command, cwd)) {
    return block("G3_PATH_DENIED", "command references a G3-protected directory");
  }
  if (commandMentionsProtectedGovernancePath(command) && isWriteShapedCommand(command)) {
    return block("GATE_MUTATION_DENIED", "execution sessions cannot modify the governance gate");
  }

  const approvedScript = evaluateApprovedScriptArguments(command, cwd);
  if (approvedScript) return approvedScript;

  const deniedShapes = [
    [
      /\b(?:grep|egrep|fgrep)(?:\.exe)?\b[^\r\n;&|]*(?:--recursive(?:\s|=|$)|\s-[a-z]*[rR][a-z]*(?=\s|$))/i,
      "RECURSIVE_GREP_DENIED",
      "recursive grep is prohibited; use a named file or scoped built-in search",
    ],
    [
      /\b(?:rg|ripgrep)(?:\.exe)?\b/i,
      "SHELL_RG_DENIED",
      "shell ripgrep is prohibited; use the scoped Grep tool with an explicit path",
    ],
    [
      /\bgit\s+grep\b/i,
      "GIT_GREP_DENIED",
      "git grep is prohibited; use the scoped Grep tool with an explicit path",
    ],
    [
      /\b(?:select-string|findstr)\b/i,
      "SHELL_SEARCH_DENIED",
      "shell search commands are prohibited; use the scoped Grep tool with an explicit path",
    ],
    [
      /(?:^|[;&|]\s*)find(?:\.exe)?\b/i,
      "FIND_DENIED",
      "recursive filesystem enumeration with find is prohibited",
    ],
    [
      /\b(?:get-childitem|gci)\b[^\r\n;&|]*(?:-recurse\b|-r\b)/i,
      "POWERSHELL_RECURSE_DENIED",
      "recursive PowerShell enumeration is prohibited",
    ],
    [
      /(?:^|[;&|]\s*)ls\b[^\r\n;&|]*\s-[a-z]*R[a-z]*(?=\s|$)/,
      "LS_RECURSE_DENIED",
      "recursive ls enumeration is prohibited",
    ],
    [
      /(?:^|[;&|]\s*)dir\b[^\r\n;&|]*\/s\b/i,
      "DIR_RECURSE_DENIED",
      "recursive dir enumeration is prohibited",
    ],
    [
      /\bgit\s+init\b/i,
      "PROBE_REPOSITORY_DENIED",
      "creating a probe or scratch repository is not authorized",
    ],
    [
      /\b(?:mkdir|md|new-item)\b[^\r\n;&|]*(?:scratch|probe)/i,
      "PROBE_DIRECTORY_DENIED",
      "creating probe or scratch directories is not authorized",
    ],
    [
      /\bmktemp\b|\bnew-temporaryfile\b|\$env:(?:tmp|temp)\b|%(?:tmp|temp)%|\$(?:tmpdir|tmp|temp)\b|\/tmp\//i,
      "TEMP_OBJECT_DENIED",
      "execution sessions cannot create project evidence in temporary storage",
    ],
  ];
  for (const [pattern, code, reason] of deniedShapes) {
    if (pattern.test(command)) return block(code, reason);
  }
  return allow();
}

export function evaluateToolCall(event, cwd = event?.cwd || PROJECT_ROOT) {
  const toolName = String(event?.tool_name ?? "");
  const input = event?.tool_input ?? {};

  if (event?.agent_type) {
    return block("DERIVED_ROLE_DENIED", "derived roles may not use project tools");
  }
  if (toolName === "Agent") {
    return block("AGENT_DENIED", "derived roles are disabled by project governance");
  }
  if (toolName === "Monitor") {
    return block("BACKGROUND_DENIED", "background monitors are disabled by project governance");
  }
  if (toolName === "PowerShell") {
    return block("POWERSHELL_TOOL_DENIED", "PowerShell is disabled; use the governed Bash surface");
  }
  if (toolName === "Bash") return evaluateBash(input, cwd);

  if (["Read", "Edit", "Write"].includes(toolName)) {
    if (hasForbiddenSegments(input.file_path, cwd)) {
      return block("G3_PATH_DENIED", `${toolName} targets a G3-protected directory`);
    }
    if (["Edit", "Write"].includes(toolName) && isProtectedGovernancePath(input.file_path, cwd)) {
      return block("GATE_MUTATION_DENIED", "execution sessions cannot modify the governance gate");
    }
    return allow();
  }

  if (toolName === "Grep") {
    if (hasForbiddenSegments(input.path, cwd)) {
      return block("G3_PATH_DENIED", "Grep targets a G3-protected directory");
    }
    if (isBroadSearchScope(input.path, cwd)) {
      return block("BROAD_SEARCH_DENIED", "Grep requires an explicit non-broad path");
    }
    return allow();
  }

  if (toolName === "Glob") {
    if (hasForbiddenSegments(input.path, cwd)) {
      return block("G3_PATH_DENIED", "Glob targets a G3-protected directory");
    }
    if (isBroadSearchScope(input.path, cwd) || String(input.pattern ?? "").includes("**")) {
      return block("BROAD_GLOB_DENIED", "Glob requires an explicit path and a non-recursive pattern");
    }
    return allow();
  }

  return allow();
}

function assertCheck(checks, condition, label) {
  checks.push({ label, passed: Boolean(condition) });
}

export async function verifyGovernanceGate(root = PROJECT_ROOT) {
  const checks = [];
  const settings = JSON.parse(
    await readFile(path.join(root, ".claude", "settings.json"), "utf8")
  );
  const principles = await readFile(path.join(root, "PRINCIPLES.md"), "utf8");
  const claudeInstructions = await readFile(path.join(root, "CLAUDE.md"), "utf8");
  const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");

  const deny = settings?.permissions?.deny ?? [];
  const requiredDenyRules = ["Agent", "Monitor", "PowerShell"];
  for (const leaf of FORBIDDEN_LEAF_NAMES) {
    requiredDenyRules.push(`Read(/validation/${leaf}/**)`);
    requiredDenyRules.push(`Edit(/validation/${leaf}/**)`);
  }
  for (const required of requiredDenyRules) {
    assertCheck(checks, deny.includes(required), `shared deny rule: ${required}`);
  }

  const preToolGroups = settings?.hooks?.PreToolUse ?? [];
  const hook = preToolGroups
    .filter((group) => String(group.matcher ?? "").includes("Agent"))
    .flatMap((group) => group.hooks ?? [])
    .find(
      (candidate) =>
        candidate.type === "command" &&
        candidate.command === "node validation/system/governance_gate.mjs --hook"
    );
  assertCheck(checks, Boolean(hook), "shared PreToolUse governance hook");
  assertCheck(checks, hook?.timeout === 5, "governance hook has bounded timeout");
  const requiredHookTools = [
    "Bash",
    "Read",
    "Edit",
    "Write",
    "Glob",
    "Grep",
    "Agent",
    "Monitor",
    "PowerShell",
  ];
  assertCheck(
    checks,
    preToolGroups.some((group) => {
      const matchedTools = String(group.matcher ?? "").split("|");
      return requiredHookTools.every((tool) => matchedTools.includes(tool));
    }),
    "PreToolUse matcher covers every governed tool"
  );

  for (const required of ["!.claude/", ".claude/*", "!.claude/settings.json"]) {
    assertCheck(checks, gitignore.split(/\r?\n/).includes(required), `.gitignore: ${required}`);
  }
  for (const required of [
    "### 2026-07-18 · Part 9 执行边界事件",
    "| G3-M | P3/P6/P10 |",
    "只写提示语不算机器闸门",
    "v1.1 登记 Part 9 执行边界事件；强化 G6/G10，新增 G3-M 机器闸门与销案条件（起草：评审方；批准：项目决策人）",
    "### 2026-07-19 · 获批脚本参数面授权边界事件",
    "获批脚本只能以其登记真实路径与全局登记模式集内的单个字面模式实参调用",
    "v1.3 登记获批脚本参数面授权边界事件；G3-M 增补参数面有限命令门与常设正负例（起草：制包 CC；批准：项目决策人）",
  ]) {
    assertCheck(checks, principles.includes(required), `PRINCIPLES marker: ${required}`);
  }
  for (const required of [
    "## Before the first tool call",
    "## Permanent execution controls",
    "## Required full-response closeout",
  ]) {
    assertCheck(checks, claudeInstructions.includes(required), `CLAUDE marker: ${required}`);
  }

  const fixture = (tool_name, tool_input = {}, extra = {}) => ({
    cwd: root,
    tool_name,
    tool_input,
    ...extra,
  });
  const deniedCases = [
    ["Agent", fixture("Agent", { prompt: "inspect everything" }), "AGENT_DENIED"],
    [
      "Monitor background tool",
      fixture("Monitor", { command: "poll deployment", run_in_background: true }),
      "BACKGROUND_DENIED",
    ],
    [
      "PowerShell tool",
      fixture("PowerShell", { command: "Get-Content README.md" }),
      "POWERSHELL_TOOL_DENIED",
    ],
    [
      "derived-role tool use",
      fixture("Read", { file_path: "README.md" }, { agent_type: "Explore" }),
      "DERIVED_ROLE_DENIED",
    ],
    [
      "protected Read",
      fixture("Read", { file_path: path.join(root, "validation", "private", "x.md") }),
      "G3_PATH_DENIED",
    ],
    [
      "protected Grep",
      fixture("Grep", { pattern: "x", path: path.join(root, "validation", "raw") }),
      "G3_PATH_DENIED",
    ],
    ["pathless Grep", fixture("Grep", { pattern: "x" }), "BROAD_SEARCH_DENIED"],
    [
      "validation-directory Grep",
      fixture("Grep", { pattern: "x", path: "validation/system" }),
      "BROAD_SEARCH_DENIED",
    ],
    ["recursive Glob", fixture("Glob", { pattern: "**/*.md", path: "docs" }), "BROAD_GLOB_DENIED"],
    [
      "recursive grep",
      fixture("Bash", { command: "grep -R TODO ." }),
      "RECURSIVE_GREP_DENIED",
    ],
    ["shell rg", fixture("Bash", { command: "rg TODO README.md" }), "SHELL_RG_DENIED"],
    ["git grep", fixture("Bash", { command: "git grep TODO" }), "GIT_GREP_DENIED"],
    [
      "PowerShell search",
      fixture("Bash", { command: "Select-String -Pattern TODO -Path *" }),
      "SHELL_SEARCH_DENIED",
    ],
    [
      "PowerShell recursion",
      fixture("Bash", { command: "Get-ChildItem validation -Recurse" }),
      "POWERSHELL_RECURSE_DENIED",
    ],
    ["find enumeration", fixture("Bash", { command: "find . -type f" }), "FIND_DENIED"],
    ["dir recursion", fixture("Bash", { command: "dir /s" }), "DIR_RECURSE_DENIED"],
    ["probe repository", fixture("Bash", { command: "git init scratch" }), "PROBE_REPOSITORY_DENIED"],
    [
      "probe directory",
      fixture("Bash", { command: "mkdir scratch-check" }),
      "PROBE_DIRECTORY_DENIED",
    ],
    ["temporary object", fixture("Bash", { command: "mktemp" }), "TEMP_OBJECT_DENIED"],
    [
      "background task",
      fixture("Bash", { command: "node validation/system/run.js", run_in_background: true }),
      "BACKGROUND_DENIED",
    ],
    [
      "protected-path Bash",
      fixture("Bash", {
        command: `type ${path.join(root, "validation", "private", "PROJECT_STATE.md")}`,
      }),
      "G3_PATH_DENIED",
    ],
    [
      "governance mutation",
      fixture("Edit", { file_path: path.join(root, "PRINCIPLES.md") }),
      "GATE_MUTATION_DENIED",
    ],
    ["scan without a mode", fixture("Bash", { command: "sh ../g8_scan.sh" }), "G8_MODE_DENIED"],
    ["scan unknown mode", fixture("Bash", { command: "sh ../g8_scan.sh file" }), "G8_MODE_DENIED"],
    ["scan listing mode", fixture("Bash", { command: "sh ../g8_scan.sh list" }), "G8_MODE_DENIED"],
    ["scan variable mode", fixture("Bash", { command: 'sh ../g8_scan.sh "$MODE"' }), "G8_MODE_DENIED"],
    ["scan extra argument", fixture("Bash", { command: "sh ../g8_scan.sh tree extra" }), "G8_MODE_DENIED"],
    ["scan same name relative path", fixture("Bash", { command: "sh ./evil/g8_scan.sh msg" }), "G8_MODE_DENIED"],
    ["scan same name absolute path", fixture("Bash", { command: "sh /c/Users/x/g8_scan.sh tree" }), "G8_MODE_DENIED"],
    ["scan glob question mark", fixture("Bash", { command: "sh ../g8_scan.s? list" }), "G8_MODE_DENIED"],
    ["scan glob bracket", fixture("Bash", { command: "sh ../g8_scan.s[h] list" }), "G8_MODE_DENIED"],
    ["scan variable path", fixture("Bash", { command: "sh $S list" }), "G8_MODE_DENIED"],
    ["scan brace constructed path", fixture("Bash", { command: "sh ${P}scan.sh list" }), "G8_MODE_DENIED"],
    ["scan assignment then variable", fixture("Bash", { command: "S=../g8_scan.sh; sh $S list" }), "G8_MODE_DENIED"],
    ["scan backtick substitution", fixture("Bash", { command: "sh `echo ../g8_scan.sh` tree" }), "G8_MODE_DENIED"],
    ["scan tilde path", fixture("Bash", { command: "sh ~/g8_scan.sh tree" }), "G8_MODE_DENIED"],
    ["scan quoted path", fixture("Bash", { command: 'sh "../g8_scan.sh" tree' }), "G8_MODE_DENIED"],
    ["scan quoted mention", fixture("Bash", { command: "grep -n 'g8_scan.sh' README.md" }), "G8_MODE_DENIED"],
    ["scan through sh -c", fixture("Bash", { command: 'sh -c "../g8_scan.sh list"' }), "G8_MODE_DENIED"],
  ];
  for (const [label, event, expectedCode] of deniedCases) {
    const result = evaluateToolCall(event, root);
    assertCheck(
      checks,
      result.allowed === false && result.code === expectedCode,
      `deny: ${label} (${expectedCode})`
    );
  }

  const allowedCases = [
    ["named Read", fixture("Read", { file_path: "README.md" })],
    ["named Grep", fixture("Grep", { pattern: "Citation", path: "docs/RELEASE.md" })],
    ["non-recursive Glob", fixture("Glob", { pattern: "*.md", path: "docs" })],
    ["system gate", fixture("Bash", { command: "node validation/system/run.js" })],
    ["Git status", fixture("Bash", { command: "git status --short" })],
    ["named grep", fixture("Bash", { command: "grep -n G10 PRINCIPLES.md" })],
    ["scan tree mode", fixture("Bash", { command: "sh ../g8_scan.sh tree" })],
    ["scan struct mode", fixture("Bash", { command: "sh ../g8_scan.sh struct" })],
    ["scan head mode", fixture("Bash", { command: "sh ../g8_scan.sh head" })],
    ["scan msg mode", fixture("Bash", { command: "sh ../g8_scan.sh msg" })],
    ["scan direct without sh", fixture("Bash", { command: "../g8_scan.sh tree" })],
    ["unrelated subshell status", fixture("Bash", { command: 'test -z "$(git --no-optional-locks status --porcelain)"' })],
    ["unrelated ls-remote", fixture("Bash", { command: "timeout 60 git ls-remote --tags origin" })],
    ["unrelated approved script", fixture("Bash", { command: "sh validation/system/pages_check.sh CHANGELOG.md docs/RELEASE.md" })],
  ];
  for (const [label, event] of allowedCases) {
    assertCheck(checks, evaluateToolCall(event, root).allowed, `allow: ${label}`);
  }

  const failed = checks.filter((check) => !check.passed);
  if (failed.length > 0) {
    throw new Error(`governance gate failed: ${failed.map((check) => check.label).join("; ")}`);
  }
  return { passed: checks.length, checks };
}

async function readStdin() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}

async function main() {
  if (process.argv.includes("--hook")) {
    let event;
    try {
      event = JSON.parse(await readStdin());
    } catch (error) {
      console.error(`GOVERNANCE GATE BLOCK: invalid hook input: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    const result = evaluateToolCall(event);
    if (!result.allowed) {
      console.error(`GOVERNANCE GATE BLOCK [${result.code}]: ${result.reason}`);
      process.exitCode = 2;
    }
    return;
  }

  const result = await verifyGovernanceGate();
  console.log(`governance gate: ${result.passed}/${result.passed} checks passed`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`GOVERNANCE GATE FAIL: ${error.message}`);
    process.exitCode = 1;
  });
}
