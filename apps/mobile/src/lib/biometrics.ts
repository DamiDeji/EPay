import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricCapability {
  available: boolean;
  enrolled: boolean;
  /** 'face' | 'fingerprint' | 'iris' — for UI copy. */
  kind: 'face' | 'fingerprint' | 'iris' | 'none';
}

/** Inspect device biometric support so the UI can explain the requirement. */
export async function getBiometricCapability(): Promise<BiometricCapability> {
  const [available, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  let kind: BiometricCapability['kind'] = 'none';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    kind = 'face';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    kind = 'fingerprint';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    kind = 'iris';
  }

  return { available, enrolled, kind };
}

/**
 * Gate a payment action behind a biometric prompt.
 *
 * Returns `true` only when the user successfully authenticates. Device-passcode
 * fallback is deliberately disabled for payment authorization, so a stolen
 * unlocked phone alone cannot move funds.
 */
export async function requireBiometric(reason = 'Authorize this payment'): Promise<boolean> {
  const capability = await getBiometricCapability();
  if (!capability.available || !capability.enrolled) {
    // No biometric hardware/enrolment: fail closed and let the caller decide.
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
    requireConfirmation: false,
  });

  return result.success;
}
