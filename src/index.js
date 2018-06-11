const { processCommands } = require('src/cli');

exports.start = async (options) => {
  await processCommands({ argv: options.argv });
};
