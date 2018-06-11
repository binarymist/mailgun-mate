const convict = require('convict');
const path = require('path');

const schema = {
  env: {
    doc: 'The application environment.',
    format: ['production', 'development', 'test'],
    default: 'production',
    env: 'NODE_ENV'
  },
  logger: {
    level: {
      doc: 'Write all log events with this level and below. Syslog levels used: https://github.com/winstonjs/winston#logging-levels',
      format: ['emerg', 'alert', 'crit', 'error', 'warning', 'notice', 'info', 'debug'],
      default: 'notice'
    }
  },
  emailList: {
    doc: 'The mailgun email list you would like to use.',
    format: String,
    default: ''
  },
  'o:testmode': {
    doc: 'Whether you would like to send emails in test mode of not (https://documentation.mailgun.com/en/latest/user_manual.html#sending-in-test-mode).',
    format: 'Boolean',
    default: true
  },
  domain: {
    doc: 'The mail domain.',
    format: String,
    default: ''
  }
};

const config = convict(schema);
config.loadFile(path.join(__dirname, `config.${process.env.NODE_ENV}.json`));
config.validate();
console.log('(*) Local config file loaded'); // eslint-disable-line no-console

module.exports = config;
