const sywac = require('sywac');
const chalk = require('chalk');
const figlet = require('figlet');
const pkg = require('../package.json');
const log = require('purpleteam-logger').logger(); // eslint-disable-line no-unused-vars
const { scheduleDelivery: scheduleDeliveryApi } = require('./api');

const processCommands = async (options) => { // eslint-disable-line no-unused-vars
  const cliArgs = await sywac // eslint-disable-line no-unused-vars
    .registerFactory('MailgunDateTimeFormat', opts => new scheduleDeliveryApi.MailgunDateTimeFormat(opts))
    .usage('Usage: $0 [command] [option(s)]')
    .commandDirectory('cmds')
    // This overrides the --help and --version and adds their aliases
    .showHelpByDefault()
    .boolean('-a, --about', { desc: 'Show about screen' })
    .version('-v, --version', { desc: 'Show version number' })
    .help('-h, --help')
    .preface(figlet.textSync(pkg.name, 'Chunky'), chalk.bgHex('#9961ed')(pkg.description))
    .epilogue(`For more informatiion, find the README at ${pkg.homepage}`)
    .style({
      // usagePrefix: str => chalk.hex('#9961ed').bold(str),
      flags: str => chalk.bold(str),
      group: str => chalk.hex('#9961ed').bold(str),
      messages: str => chalk.keyword('orange').bold(str)
    })
    .parseAndExit();
};

module.exports = {
  processCommands
};
