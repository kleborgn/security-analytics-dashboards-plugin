/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import { EuiButton, EuiFlexGroup, EuiFlexItem } from '@elastic/eui';
import {
  DetectorHit,
  RuleSource,
  SearchDetectorsResponse,
} from '../../../../../server/models/interfaces';
import { Detector } from '../../../../../models/interfaces';
import ConfigureAlerts from '../../../CreateDetector/components/ConfigureAlerts';
import { DetectorsService, NotificationsService, OpenSearchService } from '../../../../services';
import { RuleOptions } from '../../../../models/interfaces';
import {
  ROUTES,
  OS_NOTIFICATION_PLUGIN,
  EMPTY_DEFAULT_DETECTOR,
} from '../../../../utils/constants';
import { NotificationsStart } from 'opensearch-dashboards/public';
import {
  errorNotificationToast,
  getPlugins,
  successNotificationToast,
} from '../../../../utils/helpers';
import { DetectorCreationStep } from '../../../CreateDetector/models/types';
import { ServerResponse } from '../../../../../server/models/types';
import { DataStore } from '../../../../store/DataStore';

export interface UpdateAlertConditionsProps
  extends RouteComponentProps<any, any, { detectorHit: DetectorHit }> {
  detectorService: DetectorsService;
  opensearchService: OpenSearchService;
  notificationsService: NotificationsService;
  notifications: NotificationsStart;
}

export interface UpdateAlertConditionsState {
  detector: Detector;
  rules: object;
  rulesOptions: RuleOptions[];
  submitting: boolean;
  plugins: string[];
  isTriggerNameValid: boolean;
}

export default class UpdateAlertConditions extends Component<
  UpdateAlertConditionsProps,
  UpdateAlertConditionsState
> {
  constructor(props: UpdateAlertConditionsProps) {
    super(props);

    const detector = {
      ...(props.location.state?.detectorHit?._source || EMPTY_DEFAULT_DETECTOR),
      id: props.location.pathname.replace(`${ROUTES.EDIT_DETECTOR_ALERT_TRIGGERS}/`, ''),
    };
    this.state = {
      detector,
      rules: {},
      rulesOptions: [],
      submitting: false,
      plugins: [],
      isTriggerNameValid: true,
    };
  }

  componentDidMount() {
    this.getRules();
    this.getPlugins();
  }

  changeDetector = (detector: Detector) => {
    this.setState({ detector: detector });
  };

  getRules = async () => {
    try {
      const { detectorService } = this.props;
      const { detector } = this.state;
      if (!detector.name) {
        const response = (await detectorService.getDetectors()) as ServerResponse<
          SearchDetectorsResponse
        >;
        if (response.ok) {
          const detectorHit = response.response.hits.hits.find(
            (detectorHit) => detectorHit._id === detector.id
          ) as DetectorHit;
          this.setState({
            detector: {
              ...detectorHit._source,
              id: detectorHit._id,
            },
          });
        }
      }
      const terms = { 'rule.category': [detector.detector_type.toLowerCase()] };

      const customRules = await DataStore.rules.getCustomRules(terms);
      const prePackagedRules = await DataStore.rules.getPrePackagedRules(terms);

      const allRules: { [id: string]: RuleSource } = {};
      const rulesOptions = new Set<RuleOptions>();

      prePackagedRules.forEach((hit) => {
        allRules[hit._id] = hit._source;
        const rule = allRules[hit._id];
        rulesOptions.add({
          name: rule.title,
          id: hit._id,
          severity: rule.level,
          tags: rule.tags.map((tag) => tag.value),
        });
      });

      customRules.forEach((hit) => {
        allRules[hit._id] = hit._source;
        const rule = allRules[hit._id];
        rulesOptions.add({
          name: rule.title,
          id: hit._id,
          severity: rule.level,
          tags: rule.tags.map((tag) => tag.value),
        });
      });

      this.setState({ rules: allRules, rulesOptions: Array.from(rulesOptions) });
    } catch (e: any) {
      errorNotificationToast(this.props.notifications, 'retrieve', 'rules', e);
    }
  };

  async getPlugins() {
    const { opensearchService } = this.props;
    const plugins = await getPlugins(opensearchService);

    this.setState({ plugins });
  }

  onCancel = () => {
    this.props.history.replace({
      pathname: `${ROUTES.DETECTOR_DETAILS}/${this.props.location.state?.detectorHit._id}`,
      state: this.props.location.state,
    });
  };

  onSave = async () => {
    this.setState({ submitting: true });
    const { detector } = this.state;
    const {
      history,
      detectorService,
      location: { state },
    } = this.props;

    const {
      detectorHit = {
        _source: detector,
        _id: detector.id || '',
      },
    } = state || {};

    try {
      const updateDetectorResponse = await detectorService.updateDetector(
        detectorHit._id,
        detector
      );
      if (!updateDetectorResponse.ok) {
        errorNotificationToast(
          this.props.notifications,
          'update',
          'detector',
          updateDetectorResponse.error
        );
      } else {
        successNotificationToast(this.props.notifications, 'updated', 'detector');
      }
    } catch (e: any) {
      errorNotificationToast(this.props.notifications, 'update', 'detector', e);
    }

    this.setState({ submitting: false });
    history.replace({
      pathname: `${ROUTES.DETECTOR_DETAILS}/${detectorHit._id}`,
      state: {
        detectorHit: { ...detectorHit, _source: { ...detectorHit._source, ...detector } },
      },
    });
  };

  updateDataValidState = (step: DetectorCreationStep, isValid: boolean): void => {
    this.setState({
      isTriggerNameValid: isValid,
    });
  };

  render() {
    const { detector, rulesOptions, submitting, isTriggerNameValid } = this.state;
    const isSaveDisabled = submitting || !isTriggerNameValid;
    return (
      <div>
        <ConfigureAlerts
          {...this.props}
          isEdit={true}
          detector={detector}
          rulesOptions={rulesOptions}
          changeDetector={this.changeDetector}
          updateDataValidState={this.updateDataValidState}
          hasNotificationPlugin={this.state.plugins.includes(OS_NOTIFICATION_PLUGIN)}
        />

        <EuiFlexGroup justifyContent={'flexEnd'}>
          <EuiFlexItem grow={false}>
            <EuiButton disabled={submitting} onClick={this.onCancel}>
              Cancel
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiButton
              disabled={isSaveDisabled}
              fill={true}
              isLoading={submitting}
              onClick={this.onSave}
            >
              Save changes
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </div>
    );
  }
}
