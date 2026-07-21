/**
 * jiraFields.js
 *
 * Helpers for resolving Jira custom field IDs by their display name, and
 * for building Atlassian Document Format (ADF) descriptions.
 *
 * Jira's v3 issue-create API needs internal field IDs like
 * "customfield_10087", not the human label you see in the UI ("EPIC
 * Number"). Rather than hardcoding IDs (which differ per Jira instance and
 * are easy to get wrong), this looks them up by name via /rest/api/3/field
 * and caches the result for the run.
 */

import axios from 'axios';

let fieldCache = null;

/**
 * Fetches and caches the full list of fields (system + custom) for this
 * Jira instance.
 *
 * @param {string} jiraBaseUrl
 * @param {object} authHeader
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function loadFields(jiraBaseUrl, authHeader) {
  if (fieldCache) return fieldCache;

  const response = await axios.get(
    `${jiraBaseUrl}/rest/api/3/field`,
    { headers: authHeader }
  );

  fieldCache = response.data;
  return fieldCache;
}

/**
 * Resolves a Jira field's internal ID from its display name.
 *
 * @param {string} jiraBaseUrl
 * @param {object} authHeader
 * @param {string} displayName - Exact label as shown in Jira's UI,
 *   e.g. "EPIC Number", "Squad Components".
 * @returns {Promise<string>} The field ID, e.g. "customfield_10087".
 * @throws if no field with that exact name is found, or if more than one
 *   field shares the name (Jira allows duplicate custom field names).
 */
export async function getFieldIdByName(jiraBaseUrl, authHeader, displayName) {
  const fields = await loadFields(jiraBaseUrl, authHeader);

  const matches = fields.filter(
    f => f.name.trim().toLowerCase() === displayName.trim().toLowerCase()
  );

  if (matches.length === 0) {
    throw new Error(
      `No Jira field found named "${displayName}". Run the field ` +
      `discovery script (npx playwright test tests/discoverFields.spec.js) ` +
      `and check the printed list for the correct label.`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple Jira fields are named "${displayName}": ` +
      matches.map(f => f.id).join(', ') +
      `. Use the field ID directly instead of the name to disambiguate.`
    );
  }

  return matches[0].id;
}

/**
 * Converts a plain-text block (with \n separating paragraphs) into a
 * minimal Atlassian Document Format (ADF) structure, which is what Jira's
 * v3 API requires for the "description" field.
 *
 * @param {string} text
 * @returns {object} ADF document
 */
export function toADF(text) {
  const paragraphs = (text || '')
    .split('\n')
    .filter(line => line.trim().length > 0);

  return {
    type: 'doc',
    version: 1,
    content: paragraphs.length > 0
      ? paragraphs.map(line => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        }))
      : [{ type: 'paragraph', content: [] }],
  };
}
