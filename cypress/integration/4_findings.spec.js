/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DETECTOR_TRIGGER_TIMEOUT, OPENSEARCH_DASHBOARDS_URL } from '../support/constants';
import sample_document from '../fixtures/sample_document.json';
import sample_index_settings from '../fixtures/sample_index_settings.json';
import sample_field_mappings from '../fixtures/sample_field_mappings.json';
import sample_detector from '../fixtures/sample_detector.json';

describe('Findings', () => {
  const ruleTags = ['low', 'windows'];
  const indexName = 'cypress-test-windows';

  before(() => {
    cy.cleanUpTests();

    // Visit Findings page
    cy.visit(`${OPENSEARCH_DASHBOARDS_URL}/findings`);

    // create test index, mappings, and detector
    cy.createIndex(indexName, sample_index_settings);
    cy.createAliasMappings(indexName, 'windows', sample_field_mappings, true);
    cy.createDetector(sample_detector);

    // Ingest a new document
    cy.ingestDocument(indexName, sample_document);

    // wait for detector interval to pass
    cy.wait(DETECTOR_TRIGGER_TIMEOUT);
  });

  beforeEach(() => {
    // Visit Alerts table page
    cy.visit(`${OPENSEARCH_DASHBOARDS_URL}/findings`);

    // Wait for page to load
    cy.waitForPageLoad('findings', {
      contains: 'Findings',
    });
  });

  it('displays findings based on recently ingested data', () => {
    // Click refresh
    cy.get('button').contains('Refresh').click({ force: true });

    // Check for non-empty findings list
    cy.contains('No items found').should('not.exist');

    // Check for expected findings
    cy.contains('sample_detector');
    cy.contains('Windows');
    cy.contains('Low');
  });

  it('displays finding details flyout when user clicks on View details icon', () => {
    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search findings"]`).ospSearch('sample_detector');

    // Click View details icon
    cy.getTableFirstRow('[data-test-subj="view-details-icon"]').then(($el) => {
      cy.get($el).click({ force: true });
    });

    // Confirm flyout contents
    cy.contains('Finding details');
    cy.contains('Rule details');

    // Close Flyout
    cy.get('.euiFlexItem--flexGrowZero > .euiButtonIcon').click({ force: true });
  });

  it('displays finding details flyout when user clicks on Finding ID', () => {
    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search findings"]`).ospSearch('sample_detector');

    // Click findingId to trigger Finding details flyout
    cy.getTableFirstRow('[data-test-subj="finding-details-flyout-button"]').then(($el) => {
      cy.get($el).click({ force: true });
    });

    // Confirm flyout contents
    cy.contains('Finding details');
    cy.contains('Rule details');

    // Close Flyout
    cy.get('.euiFlexItem--flexGrowZero > .euiButtonIcon').click({ force: true });
  });

  // TODO: this one triggers a button handler which goes throw condition and therefor is flaky
  // find a better way to test this dialog, condition is based on `indexPatternId`
  xit('displays finding details and create an index pattern from flyout', () => {
    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search findings"]`).ospSearch('sample_detector');

    // Click findingId to trigger Finding details flyout
    cy.getTableFirstRow('[data-test-subj="finding-details-flyout-button"]').then(($el) => {
      cy.get($el).click({ force: true });
    });

    cy.get('[data-test-subj="finding-details-flyout-view-surrounding-documents"]')
      .contains('View surrounding documents')
      .click({ force: true });

    cy.contains('Create index pattern to view documents');

    cy.get(
      `[data-test-subj="index_pattern_time_field_dropdown"] [data-test-subj="comboBoxSearchInput"]`
    ).type('EventTime');

    cy.get('[data-test-subj="index_pattern_form_submit_button"]')
      .contains('Create index pattern')
      .click({ force: true });

    cy.contains('cypress-test-windows* has been successfully created');

    // Close Flyout
    cy.get('.euiFlexItem--flexGrowZero > .euiButtonIcon').click({ force: true });
  });

  it('allows user to view details about rules that were triggered', () => {
    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search findings"]`).ospSearch('sample_detector');

    // open Finding details flyout via finding id link. cy.wait essential, timeout insufficient.
    cy.get(`[data-test-subj="view-details-icon"]`).eq(0).click({ force: true });

    // open rule details inside flyout
    cy.get('button', { timeout: 1000 });
    cy.get(`[data-test-subj="finding-details-flyout-rule-accordion-0"]`).click({ force: true });

    // Confirm content
    cy.contains('Documents');
    cy.contains('Detects plugged USB devices');
    cy.contains('Low');
    cy.contains('Windows');
    cy.contains(indexName);

    ruleTags.forEach((tag) => {
      cy.contains(tag);
    });
  });

  // TODO - upon reaching rules page, trigger appropriate rules detail flyout
  // see github issue #124 at https://github.com/opensearch-project/security-analytics-dashboards-plugin/issues/124

  it('opens rule details flyout when rule name inside accordion drop down is clicked', () => {
    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search findings"]`).ospSearch('sample_detector');

    // open Finding details flyout via finding id link. cy.wait essential, timeout insufficient.
    cy.getTableFirstRow('[data-test-subj="view-details-icon"]').then(($el) => {
      cy.get($el).click({ force: true });
    });

    // Click rule link
    cy.get(`[data-test-subj="finding-details-flyout-USB Device Plugged-details"]`).click({
      force: true,
    });

    // Validate flyout appearance
    cy.get('[data-test-subj="rule_flyout_USB Device Plugged"]').within(() => {
      cy.get('[data-test-subj="rule_flyout_rule_name"]').contains('USB Device Plugged');
    });
  });

  it('...can delete detector', () => {
    // Visit Detectors page
    cy.visit(`${OPENSEARCH_DASHBOARDS_URL}/detectors`);
    cy.waitForPageLoad('detectors', {
      contains: 'Threat detectors',
    });

    // filter table to show only sample_detector findings
    cy.get(`input[placeholder="Search threat detectors"]`).ospSearch('sample_detector');

    // intercept detectors and rules requests
    cy.intercept('detectors/_search').as('getDetector');
    cy.intercept('rules/_search?prePackaged=true').as('getPrePackagedRules');
    cy.intercept('rules/_search?prePackaged=false').as('getRules');

    // Click on detector to be removed
    cy.contains('sample_detector').click({ force: true });
    cy.waitForPageLoad('detector-details', {
      contains: sample_detector.name,
    });

    // wait for detector details to load before continuing
    cy.wait(['@getDetector', '@getPrePackagedRules', '@getRules']).then(() => {
      // Click "Actions" button, the click "Delete"
      cy.get('button.euiButton')
        .contains('Actions')
        .click({ force: true })
        .then(() => {
          // Confirm arrival at detectors page
          cy.get('[data-test-subj="editButton"]').contains('Delete').click({ force: true });

          // Search for sample_detector, presumably deleted
          cy.get(`input[placeholder="Search threat detectors"]`).ospSearch('sample_detector');

          // Confirm sample_detector no longer exists
          cy.contains('There are no existing detectors.');
        });
    });
  });

  after(() => cy.cleanUpTests());
});
