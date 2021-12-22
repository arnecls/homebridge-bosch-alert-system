import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { BshcClient, BoschSmartHomeBridgeBuilder, BshbUtils } from 'bosch-smart-home-bridge';
import { PLATFORM_NAME, PLUGIN_NAME, UUID } from './settings';
import { AlertSystemAccessory } from './alertAccessory';
import { HomeKitSecurityState } from './alertStates';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class BoschAlertHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];
  public Client: BshcClient;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    // TODO: Allow pairing through config option

    let clientCert: string;
    let clientKey: string;

    if (config.autoPair) {
      const certificate = BshbUtils.generateClientCertificate();
      clientCert = certificate.clientCert;
      clientKey = certificate.clientKey;
    } else {
      clientCert = Buffer.from(config.clientCert, 'base64').toString();
      clientKey = Buffer.from(config.clientKey, 'base64').toString();
    }

    const bshb = BoschSmartHomeBridgeBuilder.builder()
      .withHost(this.config.host)
      .withClientCert(clientCert)
      .withClientPrivateKey(clientKey)
      .build();

    if (config.autoPair) {
      bshb.pairIfNeeded('OSS Homebridge plugin', 'oss_homebridge_plugin', config.systemPassword);
    }

    this.log.debug('Finished initializing platform:', this.config.name);

    this.Client = bshb.getBshcClient();

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // TODO: Make profile mapping configurable

    // curl -ks "https://192.168.0.6:8444/smarthome/intrusion/profiles"
    // Iterate over .[] | select(.deleted==false && .configured==true) | .id
    // 0 = Full protection
    // 1 = Partial protection

    const profileMap = new Map<HomeKitSecurityState, number>([
      [HomeKitSecurityState.AWAY_ARM, 0],
      [HomeKitSecurityState.STAY_ARM, 1],
      //[HomeKitSecurityState.NIGHT_ARM, 0], // Currently implicit
    ]);

    const uuid = this.api.hap.uuid.generate(UUID);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      new AlertSystemAccessory(this, existingAccessory, profileMap);

    } else {
      this.log.info('Adding new alerting system');
      const accessory = new this.api.platformAccessory('Alerting system', uuid);

      new AlertSystemAccessory(this, accessory, profileMap);
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
    }
  }
}
