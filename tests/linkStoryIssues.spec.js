/**
 * linkStoryIssues.spec.js
 *
 * OPTIONAL - only relevant once a real Issue Link Type exists in Jira
 * (Jira Settings -> Issues -> Issue Linking) that connects Test issues to
 * Story issues. If Story is instead just a plain custom field, you don't
 * need this script - set STORY_LINK_FIELD_NAME in createTestsViaApi.spec.js
 * instead and skip this file entirely.
 *
 * Reads issues.json (produced by createTestsViaApi.spec.js) and, for each
 * row that has both an issueKey and a "Story Link" value, creates a real
 * Jira issue link between the two via POST /rest/api/3/issueLink.
 */

import { test } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..');

const jiraBaseUrl = process.env.JIRA_BASE_URL;
const jiraEmail = process.env.JIRA_EMAIL;
const jiraApiToken = process.env.JIRA_API_TOKEN;

const authHeader = {
  Authorization:
    'Basic ' +
    Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString('base64'),
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

const LINK_TYPE_NAME = 'TestCase';

async function createLink(inwardKey, outwardKey) {
  try {
    await axios.post(
      `${jiraBaseUrl}/rest/api/3/issueLink`,
      {
        type: { name: LINK_TYPE_NAME },
        inwardIssue: { key: inwardKey },
        outwardIssue: { key: outwardKey },
      },
      { headers: authHeader }
    );
    return { success: true, error: null };
  } catch (err) {
    const message = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`Failed to link ${inwardKey} -> ${outwardKey}: ${message}`);
    return { success: false, error: message };
  }
}

test.describe('Link Test issues to Story issues via API', () => {

  test('Create issue links from issues.json', async () => {

    test.setTimeout(600000);

    const issuesFilePath = path.join(PROJECT_ROOT, 'issues.json');
    const issues = JSON.parse(fs.readFileSync(issuesFilePath, 'utf8'));

    const linkable = issues.filter(
      row => row.issueKey && row['Story Link']
    );

    let linked = 0;
    let failed = 0;

    for (const row of linkable) {
      const { success } = await createLink(row.issueKey, row['Story Link']);
      if (success) linked++; else failed++;
    }

    console.log(`Linked: ${linked}, Failed: ${failed}, Total: ${linkable.length}`);
  });
});
