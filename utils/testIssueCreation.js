/**
 * testIssueCreation.js
 *
 * Helper functions for creating Jira Test issues via the REST API. =
 */

import path from 'path';
import fs from 'fs';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { getFieldIdByName, toADF } from './jiraFields';

export const jiraBaseUrl = process.env.JIRA_BASE_URL;
export const jiraProjectKey = process.env.JIRA_PROJECT_KEY;

export const authHeader = {
    Authorization:
        'Basic ' +
        Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64'),
    Accept: 'application/json',
    'Content-Type': 'application/json',
};

// ─────────────────────────────────────────────────────────────────────────
// CONFIG - adjust these to match your Jira instance's exact field labels
// ─────────────────────────────────────────────────────────────────────────

// Epic link field name - either the custom field name (e.g. "Epic Link") or the native Jira field name (e.g. "Epic Name"). 
// The script will resolve the actual field ID automatically.
export const EPIC_FIELD_NAME = 'EPIC Number';
export const NATIVE_EPIC_LINK_FIELD_NAME = 'Epic Link';

// Story links wont be applied for this step. It is a separate api call in linkStoryIssues.spec.js. 
// The script will resolve the actual field ID automatically if STORY_LINK_MODE is set to 'field'.
export const STORY_LINK_MODE = 'none';
export const STORY_LINK_FIELD_NAME = null;

// ─────────────────────────────────────────────────────────────────────────

/**
 * Reads the CSV file's raw bytes and decodes it correctly.
 *
 * Excel commonly saves CSVs as Windows-1252 (aka "ANSI"), not UTF-8, unless
 * "CSV UTF-8" is explicitly chosen when saving. Windows-1252 and UTF-8
 * diverge for characters like en-dashes ("–") and smart quotes - reading a
 * Windows-1252 file as UTF-8 silently corrupts those into "�" (mojibake),
 * which then gets sent to Jira as-is. This detects a UTF-8 BOM first (a
 * reliable signal the file IS UTF-8); otherwise it validates strictly as
 * UTF-8 and falls back to Windows-1252 decoding if that validation fails.
 */
function readCsvFileWithCorrectEncoding(filePath) {
    const buffer = fs.readFileSync(filePath);

    const hasUtf8Bom = buffer.length >= 3
        && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;

    if (hasUtf8Bom) {
        return buffer.slice(3).toString('utf8');
    }

    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        console.log(`Note: ${path.basename(filePath)} isn't valid UTF-8, decoding as Windows-1252 instead.`);
        return iconv.decode(buffer, 'win1252');
    }
}

export function readCsvRows(folderPath) {
    const csvFile = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(f => f.isFile())
        .map(f => f.name)
        .find(name => name.toLowerCase().endsWith('.csv'));

    if (!csvFile) {
        throw new Error(`No CSV file found in: ${folderPath}`);
    }

    const csvText = readCsvFileWithCorrectEncoding(path.join(folderPath, csvFile));

    return parse(
        csvText,
        {
            columns: header => header.map(col => col.trim()),
            skip_empty_lines: true,
            trim: true,
        }
    );
}

/**
 * Resolves all custom field IDs needed for issue creation, once.
 */
export async function resolveFieldIds() {
    const epicFieldId = await getFieldIdByName(jiraBaseUrl, authHeader, EPIC_FIELD_NAME);
    const nativeEpicLinkFieldId = await getFieldIdByName(jiraBaseUrl, authHeader, NATIVE_EPIC_LINK_FIELD_NAME);
    const storyFieldId = STORY_LINK_MODE === 'field' && STORY_LINK_FIELD_NAME
        ? await getFieldIdByName(jiraBaseUrl, authHeader, STORY_LINK_FIELD_NAME)
        : null;

    return { epicFieldId, nativeEpicLinkFieldId, storyFieldId, storyMode: STORY_LINK_MODE };
}

/**
 * Builds the Jira issue-create payload for a single CSV row.
 */
export function buildIssuePayload(row, fieldIds) {
    const fields = {
        project: { key: jiraProjectKey },
        summary: row.Summary,
        issuetype: { name: row['Issue Type'] || 'Test' },
    };

    if (row.Description) {
        fields.description = toADF(row.Description);
    }

    if (row.Priority) {
        fields.priority = { name: row.Priority };
    }

    if (row.Labels) {
        fields.labels = row.Labels
            .split(',')
            .map(l => l.trim())
            .filter(Boolean);
    }

    if (row['Epic Link'] && fieldIds.epicFieldId) {
        fields[fieldIds.epicFieldId] = row['Epic Link'];
    }

    if (row['Epic Link'] && fieldIds.nativeEpicLinkFieldId) {
        fields[fieldIds.nativeEpicLinkFieldId] = row['Epic Link'];
    }

    if (row['Story Link']) {
        if (fieldIds.storyMode === 'parent') {
            fields.parent = { key: row['Story Link'] };
        } else if (fieldIds.storyMode === 'field' && fieldIds.storyFieldId) {
            fields[fieldIds.storyFieldId] = row['Story Link'];
        }
        // storyMode === 'none' -> intentionally not set here
    }

    return { fields };
}

/**
 * Creates a single Jira issue. Returns the created issue's key, or null
 * with the error message logged if creation failed for that row (so one
 * bad row doesn't abort the whole batch).
 */
export async function createIssue(payload, summaryForLogging) {
    try {
        const response = await axios.post(
            `${jiraBaseUrl}/rest/api/3/issue`,
            payload,
            { headers: authHeader }
        );
        return { key: response.data.key, error: null };
    } catch (err) {
        const message = err.response?.data
            ? JSON.stringify(err.response.data)
            : err.message;
        console.error(`Failed to create "${summaryForLogging}": ${message}`);

        console.error(`  Payload sent: ${JSON.stringify(payload)}`);
        if (payload.fields.priority) {
            console.error(`  Priority value (JSON-escaped): ${JSON.stringify(payload.fields.priority.name)}`);
            console.error(`  Priority value length: ${payload.fields.priority.name.length}`);
        }

        return { key: null, error: message };
    }
}