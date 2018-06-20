const config = require('config/config');
const log = require('purpleteam-logger').init(config.get('logger'));
const { processCommands } = require('src/cli');

exports.start = async (options) => {
  await processCommands({ argv: options.argv });
};
