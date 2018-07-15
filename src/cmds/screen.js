const pkg = require('package.json');
const log = require('purpleteam-logger').logger();

exports.flags = '*';
exports.desc = 'Default command for about and help.';
exports.setup = {};
exports.run = (parsedArgv, context) => {
  const argv = parsedArgv;
  argv.handled = true;
  debugger;
  if (parsedArgv.about) {
    const {
      name: projectName, version, description, homepage, author: { name, email }
    } = pkg;

    log.notice(`${projectName} ${version}`);
    log.notice(description);
    log.notice(`Homepage: ${homepage}`);
    log.notice(`Created by ${name}<${email}>\n`);
  } else {
    return context.cliMessage(`Unknown argument: ${context.args}`);
  }
  return argv;
};
