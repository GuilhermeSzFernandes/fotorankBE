require('dotenv').config();
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://599224390ffb1526d5066b65e10e33bd@o4512059357593600.ingest.de.sentry.io/4512059384135760',
  tracesSampleRate: 1.0,
});
