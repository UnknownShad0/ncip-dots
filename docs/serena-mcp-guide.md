# Serena MCP Guide for DOTS JMARK

Last verified: October 25, 2026

## 1. Executive summary

Serena is a local code-intelligence tool that connects to AI coding agents through the Model Context Protocol (MCP). It gives Codex, Claude Code, and other MCP clients IDE-like operations such as:

- list the classes, functions, methods, and types in a file
- locate a symbol without reading the complete file
- find references to a class, method, function, or type
- inspect relationships across PHP and TypeScript files
- replace or insert code around a specific symbol
- perform symbol-aware refactoring such as renaming

For this Laravel, Inertia, React, and TypeScript project, Serena is most useful when a task crosses several layers:

```text
React page
    -> Inertia request
        -> Laravel route
            -> Controller method
                -> Eloquent model
                    -> Database relationship
                        -> Feature tests
```

Serena is not a new AI model. It does not replace Codex or Claude, and it does not make generated code automatically correct. It gives the agent a more precise way to find and edit existing code.

The recommended starting configuration for this repository is:

```text
Codex or Claude Code
    + Serena MCP for code navigation and focused edits
    + existing Git history and test suite for safety
```

Do not add several code-indexing MCP servers at the same time. Serena, Graphify, CodeGraph, and Repowise overlap substantially. Start with one and measure whether it improves the actual workflow.

## 2. The problem Serena addresses

Without Serena, a coding agent normally explores a repository using operations such as:

```text
list files
search for text
open a complete file or a large range of lines
search again for related names
open more files
```

This works, but it can consume unnecessary context. Text search also does not always understand whether a match is a class declaration, method call, type reference, string literal, or unrelated comment.

Serena connects to language servers and exposes structured code operations. Instead of asking for every line containing `ActionType`, the agent can request the definition or references of the `ActionType` symbol.

### Ordinary exploration

```text
Search "ActionType" throughout the repository
Read the route file
Read most of ActionTypeController.php
Read ActionType.php
Read a large section of Index.tsx
Inspect every matching test
```

### Serena-assisted exploration

```text
Find the ActionType model
List ActionTypeController methods
Find references to ActionType
Retrieve ActionTypesIndex/handleUpdate
Retrieve only the relevant test symbols
```

The second workflow can give the model less irrelevant text while still exposing the code needed for the task.

## 3. How Serena can help this project

### 3.1 Focused work in large React components

`resources/js/Pages/ActionTypes/Index.tsx` contains several distinct behaviors:

- create and edit dialog state
- form submission
- searching
- sorting
- pagination
- printing
- table rendering

For a request such as "fix the update submission," Serena can retrieve `handleUpdate` and related types instead of loading the entire component.

Example request:

```text
Use Serena to retrieve ActionTypesIndex/handleUpdate and the types it depends on.
Inspect surrounding code only if it is required to make a safe change.
```

### 3.2 Cross-layer CRUD changes

Adding a delete operation for action types could involve:

- `resources/js/Pages/ActionTypes/Index.tsx`
- `routes/web.php`
- `app/Http/Controllers/ActionTypeController.php`
- `app/Models/ActionType.php`
- document relationships and foreign keys
- authorization and audit behavior
- feature tests

Serena can identify definitions and references before the agent edits anything. This reduces the risk of implementing only the frontend portion or missing a dependent relationship.

Example request:

```text
Use Serena to identify every symbol involved in creating and updating action types.
Find references to App\Models\ActionType and identify deletion constraints.
Do not change code yet; summarize the affected symbols and tests.
```

### 3.3 Safer renaming and refactoring

Text replacement can accidentally modify unrelated strings or miss references that use aliases. Serena's symbol-oriented operations are more suitable for changes such as:

- renaming a PHP method
- finding callers before changing a method signature
- renaming a TypeScript type
- locating all references to a component or exported function
- identifying model relationships affected by a change

The agent should still inspect surrounding source and run tests. Symbol intelligence is a navigation aid, not proof that a refactor is behaviorally correct.

### 3.4 Understanding unfamiliar project areas

Serena is useful when the developer or agent does not yet know where a behavior is implemented. Good questions include:

```text
Where is action type validation performed?
Which controller supplies actionTypes to this Inertia page?
Which models reference ActionType?
What calls normalizeActionTypeDetails?
Which tests cover document routing with an action type?
```

### 3.5 Reducing repeated reads

During a long session, an agent may repeatedly search for or reopen the same definitions. Serena provides structured retrieval and project memories that can reduce repeated discovery. This only helps when the agent actually uses Serena's tools.

## 4. What Serena does not do

Serena does not:

- replace Codex or Claude
- guarantee fewer total tokens on every task
- guarantee better code
- replace unit, feature, browser, or manual testing
- understand all runtime Laravel behavior from static symbols alone
- eliminate the need to read surrounding code
- make database migrations or deployment commands safe
- protect secrets by itself
- reduce terminal output from tests or builds

Serena provides little benefit for a small request such as:

```text
Change this button label in the currently open file.
```

It provides more benefit for a request such as:

```text
Add deletion for action types, prevent deletion when referenced by documents,
update the React interface, preserve the audit trail, and add feature tests.
```

## 5. Expected benefits and realistic limits

The benefit depends heavily on the task and whether the agent chooses Serena instead of falling back to broad file reads.

Reasonable expectations for this repository are:

| Task | Expected benefit |
| --- | --- |
| Small change in the active file | Little or none |
| Locate one controller, model, or component | Small |
| Cross-file Laravel/Inertia CRUD work | Moderate |
| Find references before refactoring | Moderate to high |
| Understand an unfamiliar workflow | Moderate to high |
| Run tests or inspect build output | None |
| Edit configuration, Markdown, or Blade markup | Limited |

An independent small-repository benchmark measured a large reduction in code-reading tokens for Serena, but that result should not be treated as a guaranteed overall saving. End-to-end agent behavior varies by model, client, task, repository, and whether the model invokes the MCP tools.

For this project, a realistic target is approximately:

- 10-30% less code-reading context across a mixed set of tasks
- 15-40% less time locating symbols during cross-file work
- 5-20% faster completion for tasks dominated by repository exploration
- little or no improvement for trivial single-file edits

The correct way to decide is to measure typical work before and after installation.

## 6. Cost, license, and privacy

### 6.1 Cost

Serena's standard language-server backend and MCP server are free. Serena does not require its own API key or subscription.

Normal Codex, ChatGPT, Claude, or API costs still apply. The optional JetBrains-based backend may have separate commercial terms.

### 6.2 Current license

As of October 25, 2026:

- the Serena application in v2 and later is licensed under GPL-3.0-or-later
- SolidLSP, its reusable language-server client component, remains MIT-licensed
- Serena v1.7.0 was the last release of the full application under the MIT license

Using Serena to analyze a proprietary project does not relicense the project. GPL obligations are mainly relevant when distributing Serena itself or a derivative of it.

### 6.3 Local operation and provider exposure

Serena performs code analysis locally. Its dashboard listens on localhost by default.

When Serena returns a source symbol or snippet to Codex or Claude, that result enters the AI conversation. The AI provider can therefore receive the retrieved snippet according to the provider's normal product and privacy terms.

### 6.4 Anonymous usage reporting

Serena reports limited anonymous startup information by default, including its version, operating system, language backend, and dashboard status. Its documentation states that project-specific and personally identifiable information are not included.

Usage reporting can be disabled by providing this environment variable to the Serena process:

```bash
SERENA_USAGE_REPORTING=false
```

### 6.5 Security model

Serena can expose operations that read files, edit files, and execute commands. Its security documentation assumes that the computer, repository, MCP client, and configuration are trusted.

Recommended safeguards:

- keep the project under Git
- review changes before committing
- preserve Codex or Claude approval controls
- keep Serena's default `tools` interface instead of enabling the beta REPL
- do not expose Serena's network services beyond localhost
- use only trusted repositories
- use a container or stronger sandbox for untrusted code
- never ask the agent to inspect secrets

## 7. Repository preparation

The repository's current `.gitignore` already excludes important sensitive and generated paths, including:

```text
.env
.env.backup
.env.production
auth.json
client_secret_*.json
storage/*.key
vendor/
node_modules/
public/build/
```

Serena normally honors `.gitignore`. After Serena creates `.serena/project.yml`, verify that it contains:

```yaml
ignore_all_files_in_gitignore: true
```

Recommended additional project exclusions are:

```yaml
ignored_paths:
  - ".env"
  - ".env.*"
  - "storage/logs/**"
  - "bootstrap/cache/**"
  - "public/build/**"
  - "node_modules/**"
  - "vendor/**"
```

Patterns beginning with `*` should be quoted because the configuration is YAML.

Ignoring a file prevents ordinary Serena indexing and search from including it. This is not a complete secret-protection boundary: the coding agent may also have built-in file tools. Continue using sandbox and approval policies.

## 8. Prerequisites on macOS

The current development machine already has Homebrew and Codex installed. At the time this guide was created, `uv`, Serena, and Claude Code were not installed.

Required components:

- macOS terminal
- Homebrew
- `uv`
- Serena
- Codex and/or Claude Code
- a trusted Git repository

## 9. Install Serena

### Step 1: Install `uv`

```bash
brew install uv
```

Verify:

```bash
uv --version
```

### Step 2: Install the official Serena package

```bash
uv tool install -p 3.13 serena-agent
```

Verify:

```bash
serena --version
```

Install the official `serena-agent` package. Serena's maintainers currently recommend avoiding marketplace-generated installation entries because some contain outdated commands.

### Step 3: Initialize Serena

```bash
serena init
```

This creates Serena's global configuration and uses the free language-server backend by default.

The first time a language is used, Serena may download a supported language server into its managed directories. Its current security design pins versions and applies additional verification to supported downloads, but package-manager supply-chain risk can never be reduced to zero.

## 10. Connect Serena to Codex

### Recommended automatic setup

```bash
serena setup codex
```

Restart Codex after setup.

### Equivalent manual Codex configuration

Serena's official documentation currently uses the following entry in `~/.codex/config.toml`:

```toml
[mcp_servers.serena]
startup_timeout_sec = 15
command = "serena"
args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
```

Use the automatic setup unless manual troubleshooting is required.

### Verify from the terminal

```bash
codex mcp list
```

The list should contain `serena`.

### Verify inside Codex

Run:

```text
/mcp
```

Confirm that Serena is connected and that its tools are available.

The official OpenAI documentation states that Codex CLI and the Codex IDE extension share MCP configuration, so registration normally needs to be performed only once.

## 11. Activate this repository in Codex

The Codex desktop app may not start the Serena process with the repository as its working directory. At the beginning of the first session, use the explicit path:

```text
Activate /Users/aprillemariemolina/Desktop/dots-jmark as a project using Serena.
Then read Serena's initial instructions.
```

After activation, confirm the project path before allowing edits.

Test symbol retrieval with:

```text
Using Serena, show the symbol overview of
resources/js/Pages/ActionTypes/Index.tsx.
Do not read the entire file.
```

Then test references:

```text
Using Serena, find references to App\Models\ActionType.
Group the results into controllers, models, frontend pages, and tests.
```

## 12. Connect Serena to Claude Code

This section is optional and applies only after Claude Code is installed.

### Recommended setup

```bash
serena setup claude-code
```

### Project-only manual setup

From the repository root:

```bash
claude mcp add serena -- serena start-mcp-server --context claude-code --project "$(pwd)"
```

### Global manual setup

```bash
claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd
```

### Verify

```bash
claude mcp list
```

Inside Claude Code, run:

```text
/mcp
```

## 13. Recommended daily workflow

### Step 1: Give a concrete task

```text
Add server-side uniqueness validation for action type codes and display the
validation error in the existing dialog.
```

### Step 2: Tell the agent when Serena is valuable

```text
Use Serena first to locate the relevant React handlers, controller methods,
model fields, routes, and tests. Read full files only where surrounding context
is necessary.
```

### Step 3: Review the affected symbols

For a risky or broad change, ask for a short impact summary before editing:

```text
Before editing, list the symbols and files that will change and explain why.
```

### Step 4: Implement the change

Serena may perform symbol-level edits, while Codex or Claude may use their built-in patch tools for JSX, configuration, migrations, and other changes where full-file context is more appropriate.

### Step 5: Verify using the repository's normal tools

Depending on the change, verification can include:

```bash
php artisan test
npm run build
npm run lint
```

Use the targeted test command appropriate to the feature whenever possible.

### Step 6: Review the Git diff

```bash
git diff --check
git diff
```

Serena does not replace this review.

## 14. Prompt examples for this repository

### Locate an implementation

```text
Use Serena to locate the controller method that supplies actionTypes to the
ActionTypes/Index Inertia page. Return the method name and its dependent model
symbols without reading unrelated controller methods.
```

### Find references

```text
Use Serena to find references to App\Models\ActionType. Identify which
references create, update, display, or validate an action type.
```

### Inspect one frontend behavior

```text
Use Serena to retrieve ActionTypesIndex/handleUpdate, ActionTypeRow, and the
form state they depend on. Investigate why validation errors may not be shown.
```

### Plan a cross-layer change

```text
Use Serena to map the symbols involved in adding deletion for action types.
Check model relationships and database constraints. Do not edit yet. Produce a
short implementation and test plan based on the retrieved symbols.
```

### Refactor safely

```text
Use Serena to find callers and references before renaming this method. Inspect
the relevant surrounding code, perform the rename, then run targeted tests.
```

### Avoid unnecessary Serena use

```text
This is a small styling change in the active component. Edit the relevant JSX
directly; do not perform broad repository exploration.
```

## 15. How to measure whether Serena is helping

Do not judge Serena by advertised token-reduction percentages. Measure it on actual DOTS JMARK work.

Track five to ten representative tasks before and after installation:

| Metric | What to record |
| --- | --- |
| Completion time | Minutes from prompt to verified result |
| File-reading operations | How many full or partial files the agent reads |
| Search operations | Repeated grep/glob searches |
| Usage | Codex or Claude usage indicator before and after |
| Correctness | Whether the first implementation passes acceptance criteria |
| Missed dependencies | Related routes, models, tests, or UI surfaces initially missed |
| Rework | Number of correction prompts required |

Good evidence that Serena is helping:

- fewer broad searches
- fewer complete-file reads
- faster discovery of references
- fewer missed dependent files
- no reduction in correctness
- no meaningful increase in setup or troubleshooting time

Evidence that Serena is not helping:

- the agent ignores Serena most of the time
- Serena results are followed by identical raw file searches
- language-server startup consumes more time than navigation saves
- the agent makes edits without sufficient surrounding context
- extra MCP tools make tool selection less reliable

If no improvement is visible after a representative trial, uninstall or disable it. Plain Codex search is already capable and may be the better fit for this repository.

## 16. Troubleshooting

### `serena: command not found`

Check that the `uv` tool binary directory is available on `PATH`:

```bash
uv tool list
command -v serena
```

Restart the terminal after installation.

### Serena does not appear in Codex

```bash
codex mcp list
```

If it is missing:

```bash
serena setup codex
```

Restart Codex completely after changing MCP configuration.

### Serena is connected but has no active project

Use an explicit activation prompt:

```text
Activate /Users/aprillemariemolina/Desktop/dots-jmark as a project using Serena.
```

### Startup timeout

The first startup can be slower while language intelligence is initialized. Serena's manual Codex configuration supports:

```toml
startup_timeout_sec = 15
```

Increase it carefully if the logs show a genuine startup timeout rather than a configuration error.

### The agent does not use Serena

Be explicit for tasks where symbol navigation is useful:

```text
Use Serena's symbol and reference tools before grep or full-file reads.
```

Do not force Serena for every task. JSX layout, configuration, Markdown, and small active-file changes may be better handled using the agent's built-in tools.

### PHP or TypeScript symbols are incomplete

- allow the first index to finish
- confirm that the correct repository is active
- inspect the Serena dashboard and logs
- verify that the relevant files are not ignored
- confirm that PHP and TypeScript language intelligence started successfully
- run Serena's health-check commands shown by `serena --help`

### Dashboard behavior

The dashboard is enabled by default and normally uses:

```text
http://localhost:24282/dashboard/index.html
```

Do not bind it to a public network interface. It exposes logs and session information intended for the local developer.

## 17. Updating and uninstalling

### Update Serena

```bash
uv tool upgrade serena-agent
```

Review release notes before major-version upgrades, especially for license, configuration, and MCP interface changes.

### Remove Serena

```bash
uv tool uninstall serena-agent
```

Also remove or disable its MCP registration from Codex or Claude configuration if it remains listed after uninstalling.

Before deleting project-local `.serena` files, review whether they contain useful configuration or memories. Project-local Serena data can normally be regenerated, but deletion is unnecessary unless the integration is being removed.

## 18. Alternatives

### Plain Codex or Claude search

Best when simplicity matters and the repository is small or medium-sized. There is no index, MCP schema, or language-server integration to maintain.

### CodeGraph

Builds a local structural graph using Tree-sitter and is useful for callers, imports, and impact analysis. It is primarily a retrieval tool rather than a symbol-aware editing system.

### Repowise

Builds broader repository intelligence from code structure, Git history, documentation, and change-risk signals. It can be valuable for large or long-lived team repositories but is heavier than Serena.

### Graphify

Creates a persistent knowledge graph and visual architecture report. It is stronger for architecture exploration and call paths than routine symbol editing.

Do not run multiple code-retrieval systems by default. Every MCP integration adds tools, instructions, configuration, and maintenance. Pick one based on the dominant problem.

## 19. Recommendation for DOTS JMARK

Use Serena as a trial when work frequently involves:

- Laravel controller/model relationships
- Inertia data flow into React pages
- cross-file CRUD changes
- finding references before refactoring
- understanding document routing workflows
- unfamiliar modules with several related files

Skip or ignore Serena for:

- trivial text and styling changes
- tasks fully contained in the active file
- operations dominated by tests or terminal output
- deployments and database administration

Recommended decision process:

```text
Install Serena
    -> use it on 5-10 representative tasks
        -> compare time, usage, file reads, and correctness
            -> keep it if the measured workflow improves
            -> remove it if it adds friction without measurable value
```

Serena should remain an aid to careful engineering. The highest-value practices are still clear requirements, targeted investigation, source review, automated tests, Git diff review, and explicit approval for risky operations.

## 20. Official references

- [Serena repository](https://github.com/oraios/serena)
- [Serena installation](https://github.com/oraios/serena/blob/main/docs/02-usage/010_installation.md)
- [Serena client configuration](https://github.com/oraios/serena/blob/main/docs/02-usage/030_clients.md)
- [Serena configuration](https://oraios.github.io/serena/02-usage/050_configuration.html)
- [Serena security considerations](https://github.com/oraios/serena/blob/main/docs/02-usage/070_security.md)
- [Serena license](https://github.com/oraios/serena/blob/main/LICENSE)
- [OpenAI MCP configuration guidance](https://developers.openai.com/learn/docs-mcp)
- [Independent token-consumption comparison](https://github.com/vagkaratzas/token-consumption-benchmark/blob/main/REPORT.md)
