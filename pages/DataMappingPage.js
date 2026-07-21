/**
 * DataMappingPage.js
 *
 * Page Object for the Data Mapping step of the Zephyr Essential import
 * wizard. This step is new compared to the old Zephyr Squad wizard - it
 * appears after Field Mapping and lets you map raw CSV values for
 * components, priorities, statuses, and labels to their Zephyr equivalents.
 *
 * If the CSV values already match Zephyr's values (or there's nothing to
 * map), Zephyr Essential shows a "no data to map" message and this step
 * can simply be skipped by clicking Next/Import.
 */

import { expect } from '@playwright/test';

export default class DataMappingPage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // "Next" / "Import" button that advances past the Data Mapping step
    this.nextButton = page.getByRole('button', { name: /Next|Import/, exact: false });

    // Message shown when there is nothing to map on this step
    this.noDataMessage = page.getByText('no data to map', { exact: false });
  }

  /**
   * Advances past the Data Mapping step.
   *
   * Optionally accepts a value map (e.g. for Priority/Status/Label values
   * that differ between the CSV and the target Zephyr project) in case the
   * project does need explicit mapping here.
   *
   * @param {Record<string, string>} [valueMap] - Optional map of raw CSV
   *   values to Zephyr field values, keyed by field name.
   */
  async completeDataMapping(valueMap = {}) {
    for (const [fieldName, mapping] of Object.entries(valueMap)) {
      const row = this.page.locator(`//span[text()='${fieldName}']/../..`);
      const dropdown = row.locator('.field-group input');

      await dropdown.fill(mapping);
      await dropdown.press('Enter');
    }

    await this.nextButton.click();
  }
}
