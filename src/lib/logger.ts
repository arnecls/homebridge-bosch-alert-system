/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'homebridge';
import { Logger as BoschLogger } from 'bosch-smart-home-bridge';

// This class exposes the Hombridge logger with a logger interface compatible
// to the bosch-smart-home-bridge library
export class HomeBridgeLogWrapper implements BoschLogger {
  constructor(
    public readonly log: Logger,
  ) {
  }

  fine(message?: any, ...optionalParams: any[]): void {
    this.log.debug(message, ...optionalParams);
  }

  debug(message?: any, ...optionalParams: any[]): void {
    this.log.debug(message, ...optionalParams);
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.log.info(message, ...optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.log.warn(message, ...optionalParams);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.log.error(message, ...optionalParams);
  }
}