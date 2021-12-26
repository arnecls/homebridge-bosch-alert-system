import { Service, PlatformAccessory, CharacteristicValue, HAPStatus } from 'homebridge';
import { BshbError, BshbErrorType, BshcClient } from 'bosch-smart-home-bridge';

import { BoschAlertHomebridgePlatform } from './platform';
import { firstValueFrom } from 'rxjs';
import { rejects } from 'assert';
import { HomeKitSecurityState, BoschSecurityState, BoschAlarmState } from '../model/alertStates';

export class AlertSystemAccessory {
  private service: Service;
  private client: BshcClient;
  private profileIDToArmState: Map<number, HomeKitSecurityState>;

  constructor(
    private readonly platform: BoschAlertHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
    private readonly armStateToProfileID: Map<HomeKitSecurityState, number>,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Bosch')
      .setCharacteristic(this.platform.Characteristic.Model, 'Alerting System');

    this.client = platform.Client;
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    this.profileIDToArmState = new Map<number, HomeKitSecurityState>();
    this.armStateToProfileID.forEach((value, key) => {
      this.profileIDToArmState.set(value, key);
    });

    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Alerting System');

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.getCurrentState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onSet(this.setTargetState.bind(this))
      .onGet(this.getTargetState.bind(this));
  }

  getProfileID(armState: HomeKitSecurityState, defaultProfileID=0): number {
    const profile = this.armStateToProfileID.get(armState);
    if (profile === undefined) {
      // Not all states are mapped to profiles, so this is fine
      return defaultProfileID;
    }
    return profile;
  }

  getArmStateStr(profileIDstr: string): HomeKitSecurityState {
    const profileID = parseInt(profileIDstr, 10);
    if (profileID === undefined) {
      this.platform.log.warn('Profile is not a number:', profileIDstr);
      return HomeKitSecurityState.DISARMED;
    }
    return this.getArmState(profileID);
  }

  getArmState(profileID: number): HomeKitSecurityState {
    //this.platform.log.debug('profileToState', JSON.stringify(Object.fromEntries(this.profileIDToArmState)));

    const armState = this.profileIDToArmState.get(profileID);
    if (armState === undefined) {
      this.platform.log.warn('Profile ID not mapped to HomeKit state:', profileID);
      return HomeKitSecurityState.DISARMED;
    }
    return armState;
  }

  // Convert Bosch errors to HAP errors
  onError(err): HAPStatus {
    const error = err as BshbError;
    this.platform.log.error(error.message);

    switch (error.errorType) {
      case BshbErrorType.TIMEOUT:
        return this.platform.api.hap.HAPStatus.OPERATION_TIMED_OUT;
      case BshbErrorType.PARSING:
        return this.platform.api.hap.HAPStatus.INVALID_VALUE_IN_REQUEST;
      default:
        return this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE;
    }
  }

  async getCurrentState(): Promise<CharacteristicValue> {
    try {
      const result = await firstValueFrom(this.client.getIntrusionDetectionSystemState());
      const systemState = result.parsedResponse.armingState.state as BoschSecurityState;
      const alarmState = result.parsedResponse.alarmState.value as BoschAlarmState;

      this.platform.log.debug('System state:', systemState);
      this.platform.log.debug('Alarm state:', alarmState);

      switch (systemState) {
        case BoschSecurityState.ARMED:
          switch (alarmState) {
            case BoschAlarmState.TRIGGERED:
            case BoschAlarmState.ON:
            case BoschAlarmState.MUTED:
              return HomeKitSecurityState.ALARM_TRIGGERED;
          }
          return this.getArmStateStr(result.parsedResponse.activeConfigurationProfile.profileId);

        // If it's arming the current state is still DISARMED
        default:
          return HomeKitSecurityState.DISARMED;
      }
    } catch (error) {
      throw new this.platform.api.hap.HapStatusError(this.onError(error));
    }
  }

  async getTargetState(): Promise<CharacteristicValue> {
    try {
      const result = await firstValueFrom(this.client.getIntrusionDetectionSystemState());
      const systemState = result.parsedResponse.armingState.state as BoschSecurityState;

      this.platform.log.debug('System state:', systemState);

      switch (systemState) {
        // If it's arming the next state is ARMED
        // Disarming is instant, so target state == current state
        // No need to check alarm state here
        case BoschSecurityState.ARMED:
        case BoschSecurityState.ARMING:
          this.platform.log.debug('Target state armed');
          return this.getArmStateStr(result.parsedResponse.activeConfigurationProfile.profileId);

        default:
          this.platform.log.debug('Target state disarmed');
          return HomeKitSecurityState.DISARMED;
      }
    } catch (error) {
      throw new this.platform.api.hap.HapStatusError(this.onError(error));
    }
  }

  async setTargetState(value: CharacteristicValue) {
    this.platform.log.debug('Set state:', value as HomeKitSecurityState);
    const targetState = value as HomeKitSecurityState;
    const profileID = this.getProfileID(targetState);

    try {
      switch (targetState) {
        case HomeKitSecurityState.ALARM_TRIGGERED:
          rejects; // unsupported
          break;

        case HomeKitSecurityState.DISARMED:
          this.platform.log.info('Disarming alarm system');
          await firstValueFrom(this.client.disarmIntrusionDetectionSystem());
          return targetState;

        default:
          this.platform.log.info('Arming alarm system');
          await firstValueFrom(this.client.armIntrusionDetectionSystem(profileID));
          return targetState;
      }
    } catch (error) {
      throw new this.platform.api.hap.HapStatusError(this.onError(error));
    }
  }
}
