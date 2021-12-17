import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { BshcClient } from 'bosch-smart-home-bridge';

import { BoschAlertHomebridgePlatform } from './platform';
import { throws } from 'assert';

export class AlertSystemAccessory {
  private service: Service;
  private client: BshcClient;

  private connectionError = false;
  private state = false; // on, off, error
  private targetState = false; // on, off

  constructor(
    private readonly platform: BoschAlertHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Bosch')
      .setCharacteristic(this.platform.Characteristic.Model, 'Alerting System');

    this.client = platform.Client;
    this.service = this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Alerting System');

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .onGet(this.getCurrentState.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .onSet(this.setTargetState.bind(this))
      .onGet(this.getTargetState.bind(this));

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this;

    this.client.getIntrusionDetectionSystemState().subscribe({
      next(value) {
        _this.connectionError = false;
        _this.state = value.parsedResponse as boolean;
      },
      error(msg) {
        _this.connectionError = true;
        platform.log.error('Error Getting target state: ', msg);
      },
    });
  }

  async getCurrentState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic CurrentState');

    if (this.connectionError) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return this.state;
  }

  async getTargetState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic TargetState');

    if (this.connectionError) {
      throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
    }
    return this.targetState;
  }

  async setTargetState(value: CharacteristicValue) {
    this.platform.log.debug('Set State -> ', value as boolean);

    if (value as boolean) {
      this.client.armIntrusionDetectionSystem(); // TODO: Preset on which state
      this.targetState = true;
    } else {
      this.client.disarmIntrusionDetectionSystem();
      this.targetState = false;
    }

    // TODO evaluate response
  }
}
