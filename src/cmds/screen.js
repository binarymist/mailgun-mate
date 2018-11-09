const pkg = require('../../package.json');
const log = require('purpleteam-logger').logger();

exports.flags = '*';
exports.desc = 'Default command for about and help.';
exports.setup = {};
exports.run = (parsedArgv, context) => {
  if (parsedArgv.about) {
    const {
      name: projectName, version, description, homepage, author: { name, email }
    } = pkg;

    log.notice(`${`${projectName}`.padEnd(15)} ${version}`);
    log.notice(`${'Description:'.padEnd(15)} ${description}`);
    log.notice(`${'Homepage:'.padEnd(15)} ${homepage}`);
    log.notice(`${'Created by:'.padEnd(15)} ${name}<${email}>\n`);
  } else {
    return context.cliMessage(`Unknown argument: ${context.args}`);
  }
  return parsedArgv;
};
