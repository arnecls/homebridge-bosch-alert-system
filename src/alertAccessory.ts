import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { BshcClient } from 'bosch-smart-home-bridge';

import { BoschAlertHomebridgePlatform } from './platform';

enum IntrusionSystemState {
  Arming = 'SYSTEM_ARMING',
  Armed = 'SYSTEM_ARMED',
  Disarmed = 'SYSTEM_DISARMED',
  Unkown = '',
  Disconnect = 'DISCONNECT',
}

export class AlertSystemAccessory {
  private service: Service;
  private client: BshcClient;
  private state = IntrusionSystemState.Unkown;

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

    // See https://apidocs.bosch-smarthome.com/local/#/States/get_intrusion_states_system
    this.client.getIntrusionDetectionSystemState().subscribe({
      next(value) {
        _this.state = value.parsedResponse.armingState.state;
      },
      error(msg) {
        platform.log.error('Error Getting target state: ', msg);
        throw new platform.api.hap.HapStatusError(platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
      },
    });
  }

  async getCurrentState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic CurrentState');

    return this.state === IntrusionSystemState.Armed;
  }

  async getTargetState(): Promise<CharacteristicValue> {
    this.platform.log.debug('Get Characteristic TargetState');

    return this.state === IntrusionSystemState.Armed || this.state === IntrusionSystemState.Arming;
  }

  async setTargetState(value: CharacteristicValue) {
    this.platform.log.debug('Set State -> ', value as boolean);

    if (value as boolean) {
      this.client.armIntrusionDetectionSystem(); // TODO: Config option to define which state
    } else {
      this.client.disarmIntrusionDetectionSystem();
    }

    // TODO evaluate response
  }
}
