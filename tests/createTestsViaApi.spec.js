/**
 * createTestsViaApi.spec.js
 *
 * PIPELINE STAGE - part of the "full-process" dependency chain in
 * playwright.config.js. Replaces the old UI-driven Zephyr Essential
 * import wizard with direct Jira REST API calls.
 *
 * Reads the CSV in TEST_DATA_PATH and, for each row, creates a Jira Test
 * issue via POST /rest/api/3/issue. Writes issues.json in the same shape
 * the rest of the pipeline (attachFilesParallel, uploadEvidence,
 * downloadCSV) already expects, so downstream stages don't need to change.
 *
 * For a one-off manual sanity check before running the full batch, use
 * smokeTestCreateIssue.spec.js instead - it's intentionally NOT part of
 * this dependency chain so pipeline runs don't create a stray extra issue
 * every time.
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import {
    readCsvRows,
    resolveFieldIds,
    buildIssuePayload,
    createIssue,
} from '../utils/testIssueCreation';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..');

test.describe('Create Test issues via Jira API', () => {

    test('Build issues.json by creating each Test issue directly', async () => {

        test.setTimeout(600000);

        const folderPath = process.env.TEST_DATA_PATH;
        const csvRows = readCsvRows(folderPath);
        const fieldIds = await resolveFieldIds();

        const results = [];

        // Create each Test issue via Jira API and collect results for issues.json
        for (const row of csvRows) {
            const payload = buildIssuePayload(row, fieldIds);
            const { key, error } = await createIssue(payload, row.Summary);

            results.push({
                ...row,
                issueKey: key,
                testLink: key ? `${process.env.JIRA_BASE_URL}/browse/${key}` : null,
                testStatus: key ? 'Created' : 'Failed',
                ...(error ? { creationError: error } : {}),
            });
        }

        const issuesFilePath = path.join(PROJECT_ROOT, 'issues.json');

        fs.writeFileSync(
            issuesFilePath,
            JSON.stringify(results, null, 2),
            'utf8'
        );

        const created = results.filter(r => r.testStatus === 'Created').length;
        const failed = results.length - created;

        console.log(`issues.json written to ${issuesFilePath}`);
        console.log(`Created: ${created}, Failed: ${failed}, Total: ${results.length}`);

        if (failed > 0) {
            // Fail the step so a broken batch doesn't silently continue into
            // attachFilesParallel/uploadEvidence/downloadCSV with missing issues.
            throw new Error(`${failed} of ${results.length} Test issues failed to create - see issues.json for details.`);
        }
    });
});