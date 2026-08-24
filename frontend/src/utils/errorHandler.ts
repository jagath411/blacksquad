import { ApiError } from '../services/api/client';

export interface FormattedError {
  title: string;
  message: string;
}

export function formatUnifiedError(error: unknown, context?: string): FormattedError {
  if (!error) {
    return {
      title: 'Unexpected Issue',
      message: 'An unknown error occurred. Please try again.',
    };
  }

  // 1. ApiError from Backend
  if (error instanceof ApiError) {
    switch (error.status) {
      case 0:
        return {
          title: 'Connection Unavailable',
          message: 'Unable to connect to the BlackSquad server. Please check your internet connection.',
        };
      case 400:
        return {
          title: 'Invalid Request',
          message: error.message || 'Please check your submitted details and try again.',
        };
      case 401:
        return {
          title: 'Authentication Failed',
          message:
            context === 'login'
              ? 'Incorrect email or password. Please verify your credentials.'
              : 'Your session has expired. Please sign in again.',
        };
      case 403:
        return {
          title: 'Access Restricted',
          message: 'You do not have permission to perform this action.',
        };
      case 404:
        return {
          title: 'Not Found',
          message: error.message || 'The requested record or service could not be located.',
        };
      case 409:
        return {
          title: 'Account Exists',
          message: 'This email address is already registered. Please sign in instead.',
        };
      case 429:
        return {
          title: 'Too Many Requests',
          message: 'Please wait a moment before trying again.',
        };
      case 500:
      case 502:
      case 503:
        return {
          title: 'Server Temporarily Unavailable',
          message: 'Our backend services are currently updating. Please try again shortly.',
        };
      default:
        return {
          title: 'Request Issue',
          message: error.message || 'Unable to process your request at this time.',
        };
    }
  }

  // 2. Standard Error instance
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Google Sign-In edge cases
    if (msg.includes('cannot prompt') || msg.includes('until the request has finished')) {
      return {
        title: 'Google Sign-in Preparing',
        message: 'Google authentication window is initializing. Please tap again in a moment.',
      };
    }
    if (msg.includes('popup_closed') || msg.includes('cancelled') || msg.includes('dismiss')) {
      return {
        title: 'Sign-in Cancelled',
        message: 'Google Sign-in was cancelled before completion.',
      };
    }
    if (msg.includes('id token') || msg.includes('identity credentials')) {
      return {
        title: 'Identity Verification Failed',
        message: 'Google did not provide identity credentials. Please try signing in with email.',
      };
    }

    // Location & GPS permissions
    if (msg.includes('location permission') || msg.includes('permission was denied')) {
      return {
        title: 'Location Access Required',
        message: 'Location access is required so passengers and fleet managers can view your vehicle position.',
      };
    }
    if (msg.includes('gps') || msg.includes('enable network provider') || msg.includes('services')) {
      return {
        title: 'Device GPS Disabled',
        message: 'Please enable Location / GPS services on your phone to continue driving.',
      };
    }

    // Network / Socket
    if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) {
      return {
        title: 'Network Error',
        message: 'Unable to reach the server. Please check your network connection.',
      };
    }

    return {
      title: 'Action Failed',
      message: error.message,
    };
  }

  // 3. String error
  if (typeof error === 'string') {
    return {
      title: 'Notice',
      message: error,
    };
  }

  return {
    title: 'Unexpected Issue',
    message: 'An unexpected issue occurred. Please try again.',
  };
}
