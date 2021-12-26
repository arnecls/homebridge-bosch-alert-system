import { API } from 'homebridge';

import { PLATFORM_NAME } from './model/settings';
import { BoschAlertHomebridgePlatform } from './lib/platform';

export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, BoschAlertHomebridgePlatform);
};
