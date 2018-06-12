const convict = require('convict');
const path = require('path');
const pkg = require('package.json');

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
  appName: {
    doc: 'The name of this application.',
    format: String,
    default: `${pkg.name}`
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
  },
  mailgunTimeFormat: {
    doc: 'The mailgun time format for scheduling emails. Value is assinged to "o:deliverytime" as showen here: https://documentation.mailgun.com/en/latest/user_manual.html#scheduling-delivery. Additional details used to build the string found here: https://momentjs.com/docs/#/parsing/string-format/',
    format: String,
    default: ''
  },
  mailgunMaxFutureScheduleInDays: {
    doc: 'Messages can be scheduled for a maximum of n days in the future.',
    format: 'int',
    default: 0
  },
  emailBodyFileDir: {
    doc: 'The directory that email body files are located.',
    format: String,
    default: '~/mail-outs/'
  }
};

const config = convict(schema);
config.loadFile(path.join(__dirname, `config.${process.env.NODE_ENV}.json`));
config.validate();
// console.log('(*) Local config file loaded'); // eslint-disable-line no-console

module.exports = config;
