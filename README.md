# Jira Zephyr API — Test Case Import Pipeline

Automates importing test cases from CSV into Jira as Zephyr `Test` issues,
linking them to their parent Stories, attaching evidence, and exporting a
results report. Originally built around the Zephyr Squad UI import wizard;
migrated to Zephyr Essential, then largely replaced with direct Jira REST
API calls for reliability and speed.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the project root (never commit this — it holds a
   live Jira API token):

   ```
   JIRA_BASE_URL=https://your-instance.atlassian.net
   JIRA_EMAIL=you@example.com
   JIRA_API_TOKEN=your-api-token
   JIRA_PROJECT_KEY=YOURKEY

   TEST_DATA_PATH=C:\path\to\folder\containing\the\csv
   OUTPUT_PATH=C:\path\to\folder\for\results

   FOLDER_NAME=Descriptive Name For This Batch
   ```

   **`JIRA_PROJECT_KEY` must be the project *key* (e.g. `OKQABUG`), not the
   project *name* shown in Jira's UI** (e.g. `OKW_FMO_ADM_QA_21_25`) — these
   are different things, and using the name here fails with `"target
   project doesn't exist or you don't have permission"` even when the
   project is real and you do have access.

   If you're on Windows with OneDrive's Known Folder Move enabled, make
   sure `TEST_DATA_PATH` / `OUTPUT_PATH` point at wherever your Desktop
   *actually* resolves to (`...\OneDrive\Desktop\...` vs plain
   `...\Desktop\...`) — these can silently diverge and cause "the file
   isn't there" confusion even though the script wrote it successfully.

3. Rotate `JIRA_API_TOKEN` immediately if this `.env` (or a zip containing
   it) has ever been shared outside your machine — treat any token that's
   left your local environment as compromised.

## Expected CSV columns

`Summary`, `Description`, `Precondition`, `Test Steps`, `Expected Result`,
`Priority`, `Labels`, `Issue Type`, `Story Link`, `Epic Link`, `Issue Link`

- `Priority` must exactly match a priority name valid for this project's
  `Test` issue type (see "Diagnostic scripts" below to check — priority
  schemes are per-instance and not standardized; this project uses
  `P0`–`P3` with sub-levels like `P1-1`, not `Highest`/`Medium`/`Low`).
- `Epic Link` and `Story Link` should hold full Jira issue keys (e.g.
  `OKQABUG-8012`), not just the project prefix.
- CSVs exported from Excel are often saved as Windows-1252, not UTF-8 —
  the pipeline auto-detects and handles this, so special characters (en
  dashes, smart quotes) in your CSV shouldn't need manual fixing.

## Running the full pipeline

```
npx playwright test --project=full-process
```

This runs the full dependency chain in order:

```
create-tests-api → link-story-issues → scenarios → evidence → full-process
```

| Stage | Script | What it does |
|---|---|---|
| `create-tests-api` | `tests/createTestsViaApi.spec.js` | Creates each Test issue directly via the Jira REST API. Writes `issues.json`. Fails loudly if any row fails, so a bad batch doesn't silently continue. |
| `link-story-issues` | `tests/linkStoryIssues.spec.js` | Links every created Test to its Story using the `TestCase` Issue Link Type. |
| `scenarios` | `tests/attachFilesParallel.spec.js` | Attaches evidence files to each created issue. |
| `evidence` | `tests/uploadEvidence.spec.js` | Uploads evidence per scenario. |
| `full-process` | `tests/downloadCSV.spec.js` | Exports a results CSV, with each issue Key as a clickable Excel `HYPERLINK()` formula back to Jira. |

Shared creation logic (CSV reading, field resolution, payload building)
lives in `utils/testIssueCreation.js` so the pipeline stage and the manual
smoke test never drift out of sync.

## Manual / one-off checks

Run these individually with `npx playwright test --project=<name>`:

| Project | Purpose |
|---|---|
| `smoke-test-create-issue` | Creates **one** Test issue as a sanity check before running the full batch. Deliberately not part of the pipeline chain. |
| `discover-fields` | Lists every Jira field (system + custom) and its ID. Use to find the correct field name for `getFieldIdByName()` lookups. |
| `discover-projects` | Lists every project your API token can see, and checks whether it actually has `CREATE_ISSUES` permission on `JIRA_PROJECT_KEY`. |
| `discover-link-types` | Lists every configured Issue Link Type — the authoritative source for what's usable with `issuelinks`, more reliable than any single tool's UI dropdown. |
| `discover-issue-type-fields` | Shows every field available on the `Test` issue type for this project, including allowed values (e.g. valid Priority names). |
| `setup` | The original Zephyr Essential UI import wizard. Kept as a manual fallback; nothing in the pipeline depends on it anymore. |

## Notes on Zephyr Essential vs Zephyr Squad

This project originally drove the Zephyr Squad CSV import wizard
(`Apps → Zephyr Squad → Create a Test → Import Issues`). After migrating
to Zephyr Essential, the UI flow changed to `Tests → Importer`, with
project/issue-type/file-upload combined into one Setup step and a new
Data Mapping step added before the final import. `pages/HomePage.js`,
`pages/BulkCreateSetupPage.js`, `pages/DataMappingPage.js`, and
`pages/MappingFieldsPage.js` reflect that UI. `pages/CreateIssuePage.js`
was removed — Zephyr Essential's Importer opens directly into Setup, with
no separate landing page.

## Known field mappings (this Jira instance)

- `EPIC Number` (`customfield_10041`) — plain text field, legacy from the
  old CSV import mapping.
- `Epic Link` (`customfield_10014`) — Jira's **native** Epic Link field,
  which is actually required by this issue type's create screen. Both
  fields get set from the same CSV `Epic Link` column.
- Story linking uses the `TestCase` Issue Link Type (`inward: "testcase
  for"`, `outward: "testcases"`) — confirmed via `discover-link-types`,
  no admin setup needed. The Test issue is the `inwardIssue`, the Story is
  the `outwardIssue`.

These are specific to this Jira instance — re-run the diagnostic scripts
above if this pipeline is ever pointed at a different project or instance,
since field IDs, priority schemes, and available link types are not
guaranteed to match.


# Running the Github actions pipeline

## Setup

In order to run the automation on GitHub instead of local - add your testbook and artifacts to `inputs/your-user`. 
*Note: The files you upload to this folder will be deleted after the workflow.* 

## Steps

1. Click on the actions tab in the github repository or follow this link https://github.com/SidharthSiju/jira-full-api/actions
2. Find `.github/workflows/main.yml` on the left navbar
3. Click the run workflow dropdown and choose your user and CSV file name of the testbook you uploaded for the setup
4. Click the run workflow button
5. Go back to the code tab
6. Find your report in `reports/your-user/your-testbook-results.csv`