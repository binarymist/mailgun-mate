const config = require('../config/config');
const log = require('purpleteam-logger').init(config.get('logger')); // eslint-disable-line no-unused-vars
const { processCommands } = require('./cli');

exports.start = async (options) => {
  await processCommands({ argv: options.argv });
};
