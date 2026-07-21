/**
 * HomePage.js
 *
 * Page Object for the Jira top navigation bar.
 * Responsible for navigating from the Jira home screen into the
 * Zephyr Essential "Importer" tool.
 *
 * Zephyr Essential replaces the old Zephyr Squad "Apps -> Zephyr Squad ->
 * Create a Test -> Import Issues" path with a single top-level
 * "Tests -> Importer" entry point. There is no more "Create a Test"
 * landing page to click through first.
 */

import { expect } from '@playwright/test';
import { retryAction } from '../utils/retryHelper';

export default class HomePage {
  /**
   * @param {import('@playwright/test').Page} page - The Playwright page instance.
   */
  constructor(page) {
    this.page = page;

    // Top navigation "Tests" menu trigger (replaces the old "Apps" dropdown)
    this.testsMenuLink = page.getByRole('button', { name: 'Tests', exact: true })
      .or(page.getByText('Tests', { exact: true }));

    // "Importer" item inside the Tests dropdown
    this.importerLink = page.getByRole('menuitem', { name: 'Importer', exact: true })
      .or(page.getByText('Importer', { exact: true }));
  }

  /**
   * Waits for the DOM to finish loading before interacting with the page.
   * Should be called at the start of any action sequence.
   */
  async waitForJiraToLoad() {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Navigates through the Jira top nav to the Zephyr Essential Importer.
   *
   * Uses retryAction for the "Tests" click because Jira's navigation menus
   * can open and close unpredictably due to lazy rendering and dropdown
   * animations.
   */
  async openImporter() {
    await this.waitForJiraToLoad();

    // Wait for the Tests menu to be visible before attempting to click
    await this.testsMenuLink.waitFor({ state: 'visible', timeout: 15000 });

    // Click "Tests" and retry until the "Importer" option becomes visible
    await retryAction({
      action: async () => {
        await this.testsMenuLink.click();
      },
      successCheck: async () => {
        return await this.importerLink.isVisible();
      },
    });

    // Click "Importer" to open the Setup step of the import wizard directly
    await this.importerLink.click();
  }
}
