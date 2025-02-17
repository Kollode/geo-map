// Entry file for integration testing purposes
import { Tests } from './integration-tests';
import * as QueryString from 'query-string';
import * as Constants from '../constants';

export { Constants, Tests };

async function main(): Promise<void> {
  const params = QueryString.parse(window.location.search);
  const invalidTestNames: string[] = [];

  if (params.integration) {
    return;
  }

  // tslint:disable-next-line:no-any
  (window as any).results = Object.keys(params).map(async testName => {
    const param = params[testName];
    const input = typeof param === 'string' ? param : '';

    // tslint:disable-next-line:no-any
    const test = (Tests as any)[testName];

    if (typeof test === 'function') {
      const raw = input ? JSON.parse(input) : [];
      const parameters = Array.isArray(raw) ? raw : [raw];
      return test(...parameters);
    } else {
      invalidTestNames.push(testName);
    }
  });

  if (invalidTestNames.length > 0) {
    console.warn(`${invalidTestNames.join(', ')} are no valid testnames`);
  }

  if (invalidTestNames.length > 0 || Object.keys(params).length === 0) {
    // tslint:disable-next-line:no-console
    console.info(`Available test names: ${Object.keys(Tests).join(', ')}`);
  }
}

main();
