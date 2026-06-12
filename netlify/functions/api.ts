import serverless from 'serverless-http';

import app from '../../server';

export const handler = serverless(app, {
  binary: [
    'image/*',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
});

