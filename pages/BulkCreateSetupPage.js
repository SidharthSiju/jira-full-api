/**
 * BulkCreateSetupPage.js
 *
 * Page Object for the Setup step of the Zephyr Essential import wizard.
 *
 * Unlike the old Zephyr Squad wizard (which had a separate "select project"
 * step handled by SettingPage.js), Zephyr Essential combines project
 * selection, issue type, file type, and file upload into a single Setup
 * screen. After this step, clicking "Next" advances straight to Field
 * Mapping (handled by MappingFieldsPage).
 */

import { expect } from '@playwright/test';
import path from 'path';

export default class BulkCreateSetupPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // Project selector (single-select autocomplete)
    this.projectField = page.getByLabel('Project', { exact: false });

    // Issue Type selector - Zephyr Essential's importer only creates
    // issues of type "Test"
    this.issueTypeField = page.getByLabel('Issue Type', { exact: false });

    // File type selector (CSV / Excel / XML)
    this.fileTypeField = page.getByLabel('File Type', { exact: false });

    // Hidden/visible file input used to attach the CSV
    this.fileInput = page.locator('input[type="file"]');

    // "Next" button that advances the wizard to Field Mapping
    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
  }

  /**
   * Selects the target project and sets the issue type to "Test".
   *
   * @param {string} projectLabel - The Jira project key or name to select
   *                                 (e.g. "OKW_FMO_ADM_QA_21_25").
   */
  async selectProjectAndIssueType(projectLabel) {
    await this.projectField.fill(projectLabel);
    await this.projectField.press('Enter');

    await this.issueTypeField.fill('Test');
    await this.issueTypeField.press('Enter');
  }

  /**
   * Uploads the CSV file into the import wizard's file input, confirms
   * CSV as the file type, and advances to the next step.
   *
   * @param {string} filePath   - The filename of the CSV (e.g. "test-cases.csv").
   * @param {string} folderPath - Absolute path to the folder containing the CSV.
   *
   * Steps:
   *  1. Builds the full absolute path from folderPath + filePath.
   *  2. Ensures "CSV" is selected as the file type.
   *  3. Attaches the file to the file input.
   *  4. Waits for the filename to appear on screen to confirm the upload registered.
   *  5. Waits briefly for the UI to settle before clicking Next.
   */
  async importIssues(filePath, folderPath) {
    const testDataPath = path.join(folderPath, filePath);

    // Confirm CSV is the selected file type before attaching the file
    if (await this.fileTypeField.isVisible().catch(() => false)) {
      await this.fileTypeField.selectOption({ label: 'CSV' }).catch(async () => {
        // Fall back to a text-based selector if it isn't a native <select>
        await this.fileTypeField.fill('CSV');
        await this.fileTypeField.press('Enter');
      });
    }

    // Attach the CSV file to the file input element
    await this.fileInput.setInputFiles(testDataPath);

    // Confirm the filename label appeared, meaning the file was accepted
    await this.page.getByText(filePath).waitFor({ state: 'visible', timeout: 5000 });

    // Allow the UI to finish its post-upload animations before proceeding
    await this.page.waitForTimeout(1500);

    // Advance to the Field Mapping step of the import wizard
    await this.nextButton.click();
  }
}
