const config = require('config/config');
const log = require('purpleteam-logger').logger();
const { scheduleDelivery: scheduleDeliveryApi, common: commonApi } = require('src/api');

exports.flags = 'schedule-delivery';
exports.desc = 'Launch scheduled mail delivery, max of three days in advance.';
exports.setup = (sywac) => {
  sywac
    .showHelpByDefault(false)
    .option(
      '-l, --email-list <email-list>',
      {
        type: 'string', desc: 'The mailgun email list you would like to use.', defaultValue: config.get('emailList')
      }
    )
    .option(
      '-b, --email-body-file <email-body-file>',
      {
        type: 'file', desc: 'File containing the html for the body of the email. Relative to the emailBodyFileDir directory you set in the configuration.', required: true
      }
    )
    .option(
      '-f, --from <sent-from-for-replies>',
      {
        type: 'string', desc: 'The value that the receiver will see that your emails appear to be sent from, in the form of "Kim <services@binarymist.net>"', required: true
      }
    )
    .option(
      '-s, --subject <subject-for-email>',
      {
        type: 'string', desc: 'The subject for the email', required: true
      }
    )
    .option(
      '-t, --schedule-time <time-to-schedule-email-send-for>',
      {
        type: 'MailgunDateTimeFormat', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true
      }
    )
    .option(
      '-T, --test-mode',
      {
        type: 'boolean', desc: 'Whether or not to send in test mode "o:testmode".', defaultValue: config.get('o:testmode')
      }
    );
};
exports.run = async (parsedArgv, context) => {
  commonApi.setMailList(parsedArgv.l);
  const targetEmailBodyFilePath = `${config.get('emailBodyFileDir')}${parsedArgv.b}`;
  const htmlEmailBody = await commonApi.readFile(targetEmailBodyFilePath);
  scheduleDeliveryApi.setHtmlEmailBody(htmlEmailBody);
  log.notice(`${config.get('appName')} has your file ${targetEmailBodyFilePath}`);
  scheduleDeliveryApi.setEmailBodyFile(parsedArgv.b);
  scheduleDeliveryApi.setEmailPropsFromAddress(parsedArgv.f);
  scheduleDeliveryApi.setEmailSubject(parsedArgv.s);
  scheduleDeliveryApi.setDeliveryTime(parsedArgv.t);
  scheduleDeliveryApi.setTestMode(parsedArgv.T);
  await commonApi.authenticateToMailgun();
  await scheduleDeliveryApi.establishSubscribedListMembersForSelection();
  await scheduleDeliveryApi.runEmailCheckBoxPrompt();
  await scheduleDeliveryApi.promptForTagsToAddToBatch();
  await scheduleDeliveryApi.scheduleEmailBatch();
};
