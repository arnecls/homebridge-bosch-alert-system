export enum BoschSecurityState {
  ARMING = 'SYSTEM_ARMING',
  ARMED = 'SYSTEM_ARMED',
  DISARMED = 'SYSTEM_DISARMED'
}

export enum BoschAlarmState {
  OFF = 'ALARM_OFF',
  TRIGGERED = 'PRE_ALARM',
  ON = 'ALARM_ON',
  MUTED = 'ALARM_MUTED',
  UNKNOWN = 'UNKNOWN'
}

export enum HomeKitSecurityState {
  STAY_ARM = 0,  // The home is occupied and residents are active.
  AWAY_ARM = 1,  // The home is unoccupied.
  NIGHT_ARM = 2, // The home is occupied and residents are sleeping.
  DISARMED = 3,  // The security system is disarmed.
  ALARM_TRIGGERED = 4
}