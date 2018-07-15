const moment = require('moment');
const Type = require('sywac/types/type');
const inquirer = require('inquirer');
const config = require('config/config');
const log = require('purpleteam-logger').logger();
const commonApi = require('src/api/common');

const emailCheckBoxPrompt = inquirer.createPromptModule();
const tagInputPrompt = inquirer.createPromptModule();

const internals = { emailProps: {} };

class MailgunDateTimeFormat extends Type {
  get datatype() { // eslint-disable-line class-methods-use-this
    return 'MailgunDateTimeFormat';
  }
  validateValue(value) { // eslint-disable-line class-methods-use-this
    // https://momentjs.com/docs/#/parsing/string-format/
    const scheduledTime = moment(value, config.get('mailgunTimeFormat'));
    internals.scheduleDateIsValid = scheduledTime.isValid();
    if (!internals.scheduleDateIsValid) return false;
    internals.scheduleDateIsBeforeDeadline = scheduledTime.isBefore(moment().add(config.get('mailgunMaxFutureScheduleInDays'), 'days'));
    if (!internals.scheduleDateIsBeforeDeadline) return false;
    internals.scheduleDateIsAfterNow = scheduledTime.isAfter(moment());
    if (!internals.scheduleDateIsAfterNow) return false;

    internals.scheduledSendDateTime = value;
    return true;
  }
  buildInvalidMessage(context, msgAndArgs) {
    let customMessage;
    const localMsgAndArgs = msgAndArgs;
    super.buildInvalidMessage(context, msgAndArgs);

    if (!internals.scheduleDateIsValid) customMessage = `The datetime you entered was not valid according to mailgun's rules. RFC 2822, formatted as mailgun requires "${config.get('mailgunTimeFormat')}", See (https://documentation.mailgun.com/en/latest/user_manual.html#scheduling-delivery) for more information.`;
    else if (!internals.scheduleDateIsBeforeDeadline) customMessage = `The datetime you entered was outside of the mailgun ${config.get('mailgunMaxFutureScheduleInDays')} days schedule linmmit.`;
    else if (!internals.scheduleDateIsAfterNow) customMessage = 'The datetime you entered was in the past.';
    localMsgAndArgs.msg += ` Please specify a valid schedule datetime. ${customMessage} Please try again.`;
  }
}


const establishSubscribedListMembersForSelection = async () => {
  await commonApi.establishSubscribedListMembersAndSort((orderedDisplayableSubscribedListMembers) => {
    internals.candidatesForCheckListSelection = orderedDisplayableSubscribedListMembers.map(member => ({
      name: `${member.name.padEnd(config.get('valueToSiblingFieldPadWidth'))} ${member.address.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`,
      value: member.address
    }));
  });
};


const promptForTagsToAddToBatch = async () => {
  // Can add from 0 to 3 tags:
  //   https://documentation.mailgun.com/en/latest/user_manual.html#tagging
  //   https://documentation.mailgun.com/en/latest/user_manual.html#batch-sending

  await tagInputPrompt({
    type: 'input',
    name: 'tagsToAddToBatch',
    message: 'Would you like to add any tags? You can add up to three case insensitive, seperated by commas.',
    validate: userInput => ((userInput.length <= 128 && RegExp(/^[\x20-\x7F]*$/).test(userInput)) ? true : 'Tags can be comprised of ascii only, up to 128 characters in length.')
  }).then((answers) => {
    if (answers.tagsToAddToBatch) internals.emailProps['o:tag'] = answers.tagsToAddToBatch.split(',').map(tag => tag.trim());
  }, (err) => {
    log.notice(err);
  });
};


// Batching with mailgun: https://documentation.mailgun.com/en/latest/user_manual.html#batch-sending
// Batching via the mailgun-js abstraction: https://github.com/bojand/mailgun-js/blob/master/docs/batch.md
const addChosenMembersToBatch = () => {
  const recipientVars = {};

  const chosenSubscribedListMembers = commonApi.subscribedListMembers().filter(subscribedListMember =>
    internals.emailProps.to.some(toAddress => toAddress === subscribedListMember.address));

  chosenSubscribedListMembers.forEach((member) => {
    recipientVars[member.address] = member.vars;
  });
  internals.emailProps['recipient-variables'] = recipientVars;
  return chosenSubscribedListMembers;
};


const scheduleEmailBatch = async () => {
  const chosenSubscribedListMembers = addChosenMembersToBatch();

  await commonApi.mailgun().messages().send(internals.emailProps).then(async (sendResolution) => {
    // Todo: KC: Extract function.
    // If was successfully received by mailgun, we need to update the recipientVars of the chosenSubscribedListMembers with the date and the name of the email body file.

    if (sendResolution.id && sendResolution.message === 'Queued. Thank you.') {
      log.notice(`Emails were scheduled. Response from mailgun was:\nid: "${sendResolution.id}"\nmessage: "${sendResolution.message}"`);
      log.notice('Now updating the following list Members:');
      chosenSubscribedListMembers.forEach(listMember => log.notice(`${listMember.address} `));

      const scheduledSendToAdd = [`${internals.emailBodyFile}`, moment(internals.scheduledSendDateTime).format('YYYY-MM-DD_HH:mm:ss')];
      const promiseOfUpdateListMembers = chosenSubscribedListMembers.map(memberRecord => new Promise(async (resolve, reject) => {
        const newMemberRecord = memberRecord;
        // Stupid hack cos mailgun expects the true or false to be strings, yet they provide the value as boolean.
        newMemberRecord.subscribed = newMemberRecord.subscribed ? 'true' : 'false';
        const mailgunMateScheduledSends = memberRecord.vars.mailgunMateScheduledSends
          ? memberRecord.vars.mailgunMateScheduledSends.concat([scheduledSendToAdd])
          : [scheduledSendToAdd];
        newMemberRecord.vars.mailgunMateScheduledSends = mailgunMateScheduledSends;

        await commonApi.list().members(memberRecord.address).update(newMemberRecord)
          .then((updateResolution) => {
            log.notice(`address: ${`${updateResolution.member.address},`.padEnd(config.get('valueToSiblingFieldPadWidth'))} message: ${updateResolution.message}`);
            resolve(`Resolved promise for memberRecord ${newMemberRecord}`);
          }, (err) => {
            reject(err);
          });
      }));

      await Promise.all(promiseOfUpdateListMembers).catch(reason => log.error(reason.message));
    }
  }, (err) => {
    log.error(`There was a problem scheduling the eamils. The error was: ${err}`);
  });
};


const runEmailCheckBoxPrompt = async () => {
  await emailCheckBoxPrompt({
    type: 'checkbox',
    name: 'targetEmailAddresses',
    message: 'Which list members would you like to target? You can select up to 1000.',
    choices: internals.candidatesForCheckListSelection,
    pageSize: config.get('pageSizeOfCandidatesForCheckListSelection')
  }).then((answers) => {
    if (answers.targetEmailAddresses.length === 0) {
      log.warning('You failed to select any members.');
      process.exit(9);
    }
    internals.emailProps.to = answers.targetEmailAddresses;
  }, (err) => {
    log.error(err);
  });
};


module.exports = {
  establishSubscribedListMembersForSelection,
  MailgunDateTimeFormat,
  runEmailCheckBoxPrompt,
  promptForTagsToAddToBatch,
  scheduleEmailBatch,
  setHtmlEmailBody: (htmlEmailBody) => { internals.emailProps.html = htmlEmailBody; },
  setEmailBodyFile: (emailBodyFile) => { internals.emailBodyFile = emailBodyFile; },
  setEmailPropsFromAddress: (fromAddress) => { internals.emailProps.from = fromAddress; },
  setEmailSubject: (subject) => { internals.emailProps.subject = subject; },
  setDeliveryTime: (time) => { internals.emailProps['o:deliverytime'] = time; },
  setTestMode: (isTestMode) => { internals.emailProps['o:testmode'] = isTestMode; }
};
