const Sentry = require("@sentry/node");

// Ensure to call this before requiring any other modules!
Sentry.init({
  dsn: "https://556c8017b2c64178e7ff561a6dd89fea@o4509959318994944.ingest.us.sentry.io/4509959333740544",

  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Set sample rate for performance monitoring
  tracesSampleRate: 1.0,

  // Environment configuration
  environment: process.env.NODE_ENV || 'development',

  // Release information
  release: process.env.npm_package_version || '1.0.0',

  // Enabled in env
  enabled: process.env.NODE_ENV !== 'development',
});

module.exports = Sentry;