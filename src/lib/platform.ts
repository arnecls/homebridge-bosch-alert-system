import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { BshcClient, BoschSmartHomeBridgeBuilder } from 'bosch-smart-home-bridge';
import { PLATFORM_NAME, PLUGIN_NAME, UUID } from '../model/settings';
import { AlertSystemAccessory } from './alertAccessory';
import { HomeKitSecurityState } from '../model/alertStates';
import { firstValueFrom } from 'rxjs';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import * as selfsigned from 'selfsigned';
import { HomeBridgeLogWrapper } from './logger';

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
  // this Promise will resolve after pairing is done
  public readonly pairingProcess: Promise<unknown>;

  // Bosch client
  public Client: BshcClient;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    let clientCert: string;
    let clientKey: string;

    if (config.autoPair) {
      [clientCert, clientKey] = this.ensureClientCertificate();
    } else {
      clientCert = Buffer.from(config.clientCert, 'base64').toString();
      clientKey = Buffer.from(config.clientKey, 'base64').toString();
    }

    const bshb = BoschSmartHomeBridgeBuilder.builder()
      .withHost(this.config.host)
      .withClientCert(clientCert)
      .withClientPrivateKey(clientKey)
      .withLogger(new HomeBridgeLogWrapper(log))
      .build();

    if (config.autoPair) {
      // Initiate pairing process if required.
      // This does a test call. If this fails, pairing is started.
      this.pairingProcess = firstValueFrom(
        bshb.pairIfNeeded(
          'OSS Homebridge plugin (generated)',
          'oss_homebridge_plugin_gen',
          this.config.systemPassword));
    } else {
      // We are already paired, so resolve immedeatley
      this.pairingProcess = new Promise<void>((resolve) => {
        resolve();
      });
    }

    this.Client = bshb.getBshcClient();
    this.log.debug('Finished initializing platform:', this.config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');

      this.pairingProcess.then(() => {
        // Only add/recover devices if pairing succeded
        this.discoverDevices();
      }).catch((reason) => {
        this.log.error('Pairing failed:', reason);
      });
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  // Generates a client certificate or reads the existing one from disk.
  ensureClientCertificate() : [cert: string, key: string] {
    const storagePath = this.api.user.storagePath();
    const certFilePath = storagePath + '/bosch-client-cert.txt';
    const keyFilePath = storagePath + '/bosch-client-key.txt';

    if (existsSync(certFilePath) && existsSync(keyFilePath)) {
      this.log.info('Found existing client certficate');
      const clientCert = readFileSync(certFilePath).toString();
      const clientKey = readFileSync(keyFilePath).toString();
      return [clientCert, clientKey];
    }

    this.log.info('Generating client certficate');

    // Create a certificate that is valid for 10 years
    const cert = selfsigned.generate(null, {
      keySize: 2048,
      clientCertificate: false,
      algorithm: 'sha256',
      days: 3650});

    // We only need to generate this certificate once, regardless of
    // paring result, as peering just registers the client cert with the
    // controller.
    writeFileSync(certFilePath, cert.private);
    writeFileSync(keyFilePath, cert.cert);
    return [cert.cert, cert.private];
  }

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
