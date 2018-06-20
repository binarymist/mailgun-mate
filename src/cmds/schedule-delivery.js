const config = require('config/config');
const log = require('purpleteam-logger').logger();
const moment = require('moment');
const Type = require('sywac/types/type');
const readFileAsync = require('util').promisify(require('fs').readFile);
const inquirer = require('inquirer');
const createMailgun = require('mailgun-js');
const os = require('os');

const emailCheckBoxPrompt = inquirer.createPromptModule();
const tagInputPrompt = inquirer.createPromptModule();
const apiKeyPrompt = inquirer.createPromptModule();

const internals = { emailProps: {} };


class mailgunDateTimeFormat extends Type {
  get datatype() {
    return 'mailgunDateTimeFormat';
  }
  setValue(context, value) {
    context.assignValue(this.id, value);
  }
  validateValue(value) {
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
    super.buildInvalidMessage(context, msgAndArgs);

    if (!internals.scheduleDateIsValid) customMessage = `The datetime you entered was not valid according to mailgun's rules. RFC 2822, formatted as mailgun requires "${config.get('mailgunTimeFormat')}", See (https://documentation.mailgun.com/en/latest/user_manual.html#scheduling-delivery) for more information.`;
    else if (!internals.scheduleDateIsBeforeDeadline) customMessage = `The datetime you entered was outside of the mailgun ${config.get('mailgunMaxFutureScheduleInDays')} days schedule linmmit.`;
    else if (!internals.scheduleDateIsAfterNow) customMessage = 'The datetime you entered was in the past.';
    msgAndArgs.msg += ` Please specify a valid schedule datetime. ${customMessage} Please try again.`;
  }
}


const displayListInfo = async () => {
  internals.list = internals.mailgun.lists(internals.mailList);

  await internals.list.info().then((data) => {
    // `data` is mailing list info
    const {
      list: {
        access_level, address, created_at, description, members_count, name
      }
    } = data;
    log.notice('Authentication successful!');
    log.notice('Details for the list you selected follows:');
    log.notice(`name: "${name}"\ndescription: "${description}"\nmembers_count: ${members_count} (subscribed and unsubscribed inclusive) \naddress: "${address}"\naccess_level: "${access_level}"\ncreated_at: ${created_at}`);
  }, (err) => {
    if (err && err.statusCode === 401 && err.message === 'Unauthorized') {
      log.crit('Authentication unsuccessful! Feel free to try again.');
      log.error(`Retrieving mail list "${internals.mailList}" was unsuccessful. Error: {statusCode: ${err.statusCode}, message: ${err.message}}.`);
      process.exit(9);
    }
    log.error(`Error occured while attempting to retrieve the mail list info. Error was: "${err}"`);
  });
};


const establishSubscribedListMembersAndSort = async (workWithListMembersOnceEstablished) => {
  await displayListInfo();
  const mailgunMaxPageSize = 100;
  let listMembers;

  await internals.list.members().pages().page({ subscribed: true, limit: mailgunMaxPageSize }).then(
    async function (list) {
      listMembers = list.items;
      let nextPage = list.paging.next.split('https://api.mailgun.net/v3')[1];

      while (nextPage) {
        await internals.mailgun.get(nextPage).then((page) => {
          nextPage = page.items.length === mailgunMaxPageSize ? page.paging.next.split('https://api.mailgun.net/v3')[1] : null;
          listMembers = listMembers.concat(page.items);
        }, (err) => {
          log.error(`There was a problem getting subsequent pages from the mail list. The error was: ${err}`);
          process.exit(9);
        });
      }

      internals.subscribedListMembers = listMembers;

      // Now we need to order listMembers based on the mailgunMateScheduledSends date.
      const theyAreTheSame = 0;
      const aIsLessThanB = -1;
      const aIsGreaterThanB = 1;
      const dateTimePart = 1;

      let displayDate;

      const displayableSubscribedListMembers = internals.subscribedListMembers.map((listMember) => {
        if (listMember.vars.mailgunMateScheduledSends) {
          const dateTimes = listMember.vars.mailgunMateScheduledSends.map(scheduledSend => scheduledSend[dateTimePart]);
          const sortedDateTimes = dateTimes.sort();
          const greatestDateTime = sortedDateTimes[sortedDateTimes.length - 1];
          displayDate = greatestDateTime;
        } else {
          displayDate = '';
        }
        return { address: listMember.address, latestScheduledSend: displayDate, name: listMember.name };
      });

      const orderedDisplayableSubscribedListMembers = displayableSubscribedListMembers.sort((a, b) => {
        if (a.latestScheduledSend < b.latestScheduledSend) return aIsLessThanB;
        if (a.latestScheduledSend > b.latestScheduledSend) return aIsGreaterThanB;
        return theyAreTheSame;
      });

      if (internals.listMemberDispalyOrder === 'des') orderedDisplayableSubscribedListMembers.reverse();

      workWithListMembersOnceEstablished(orderedDisplayableSubscribedListMembers);
    }, (err) => {
      if (err && err.statusCode === 401 && err.message === 'Unauthorized') {
        log.crit('Authentication unsuccessful! Feel free to try again.');
        log.error(`Retrieving mail list mebers was unsuccessful. Error: {statusCode: ${err.statusCode}, message: ${err.message}}.`);
        process.exit(9);
      }
      log.error(`Error occured while attempting to retrieve the mail list members. Error was: "${err}"`);
    }
  );
};


const displaySubscribedListMembers = async () => {
  await establishSubscribedListMembersAndSort((orderedDisplayableSubscribedListMembers) => {
    log.notice(`\n${'Ordered Subscribed Members'.padEnd(config.get('valueToSiblingFieldPadWidth'))}DateTime Scheduled` + '\n' + 
    orderedDisplayableSubscribedListMembers.reduce(
      (accumulated, member) => 
        `${accumulated}\n${`${member.address}`.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`
        , ''
    ));
  });
};


const establishSubscribedListMembersForSelection = async () => {
  await establishSubscribedListMembersAndSort( (orderedDisplayableSubscribedListMembers) => {
    internals.candidatesForCheckListSelection = orderedDisplayableSubscribedListMembers.map(member => ({ name: `${member.name.padEnd(config.get('valueToSiblingFieldPadWidth'))} ${member.address.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`, value: member.address }));
  });
};


const promptForTagsToAddToBatch = async () => {
  // Can add from 0 to 3 tags:
  //   https://documentation.mailgun.com/en/latest/user_manual.html#tagging
  //   https://documentation.mailgun.com/en/latest/user_manual.html#batch-sending

  await tagInputPrompt({
    type: 'input',
    name: 'tagsToAddToBatch',
    message: 'Would you like to add any tags? You can add up to three, seperated by commas.',
    validate: (userInput, answersHash) => {
      // Todo: KC: provide validation.
      // Tags are case insensitive and should be ascii only. Maximum tag length is 128 characters.
      return true;
    }
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

  const chosenSubscribedListMembers = internals.subscribedListMembers.filter(subscribedListMember =>
    internals.emailProps.to.some(toAddress => toAddress === subscribedListMember.address)
  );

  chosenSubscribedListMembers.forEach((member) => {
    recipientVars[member.address] = member.vars;
  });
  internals.emailProps['recipient-variables'] = recipientVars;
  return chosenSubscribedListMembers;
};


internals.scheduleEmailBatch = async () => {
  const chosenSubscribedListMembers = addChosenMembersToBatch();

  await internals.mailgun.messages().send(internals.emailProps).then(async (sendResolution) => {
    // Todo: KC: Extract function.
    // If was successfully received by mailgun, we need to update the recipientVars of the chosenSubscribedListMembers with the date and the name of the email body file.

    if (sendResolution.id && sendResolution.message === 'Queued. Thank you.') {
      log.notice(`Emails were scheduled. Response from mailgun was:\nid: "${sendResolution.id}"\nmessage: "${sendResolution.message}"`);
      log.notice('Now updating the following list Members:');
      chosenSubscribedListMembers.forEach(listMember => log.notice(`${listMember.address} `));

      // Todo: KC: Currently internals.scheduledSendDateTime is being assigned in the run routine, as the mailgunDateTimeFormat.validateValue is broken.
      // So currently no datetime validation. If date is entered in the past, the eamil will be sent immediatly, but recorded as being sent in the past at the time that was given to mailgun-mate.
      const scheduledSendToAdd = [`${internals.emailBodyFile}`, moment(internals.scheduledSendDateTime).format('YYYY-MM-DD_HH:mm:ss')];
      const promiseOfUpdateListMembers = chosenSubscribedListMembers.map(memberRecord => new Promise(async (resolve, reject) => {
        const newMemberRecord = memberRecord;
        // Stupid hack cos mailgun expects the true or false to be strings, yet they provide the value as boolean.
        newMemberRecord.subscribed = newMemberRecord.subscribed ? 'true' : 'false';
        const mailgunMateScheduledSends = memberRecord.vars.mailgunMateScheduledSends
          ? memberRecord.vars.mailgunMateScheduledSends.concat([scheduledSendToAdd])
          : [scheduledSendToAdd];
        newMemberRecord.vars.mailgunMateScheduledSends = mailgunMateScheduledSends;

        await internals.list.members(memberRecord.address).update(newMemberRecord)
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


const authenticateToMailgun = async () => {
  const keyPath = `${os.homedir()}/.mailgun/key`;
  const provideAuthenticatedMailgun = (apiKey) => { internals.mailgun = createMailgun({ apiKey, domain: internals.mgDomain }); };

  // Todo: KC: Validate that file permissiions and ownership are as restrictive as SSH private key files.
  // https://github.com/binarymist/mailgun-mate/issues/4
  const getKeyFromHomeDir = async () => {
    try {
      return (await readFileAsync(keyPath, { encoding: 'utf8' })).trim();
    } catch (err) {
      log.warning(`Could not find mailgun private key at "${keyPath}"`);
      return false;
    }
  };

  const promptUserForKey = async () => {
    let caughtApiKey;
    await apiKeyPrompt({
      type: 'password',
      name: 'apiKey',
      message: 'Please enter your mailgun apiKey.'
    }).then((answer) => {
      caughtApiKey = answer.apiKey;
    }, (err) => {
      log.error(err);
    });
    return caughtApiKey;
  };

  provideAuthenticatedMailgun(await getKeyFromHomeDir() || await promptUserForKey());
};


exports.flags = 'schedule-delivery';
exports.description = 'Launch scheduled mail delivery, max of three days in advance.';
exports.setup = (sywac) => {
  sywac
  // Todo: KC: fix: .registerFactory('mailgunDateTimeFormat', opts => new mailgunDateTimeFormat(opts)) // Currently breaks https://github.com/sywac/sywac/issues/21
    .option(
      '-l, --email-list <email-list>',
      {
        type: 'string', desc: 'The mailgun email list you would like to use.', strinct: true, defaultValue: config.get('emailList')
      }
    )
    .option(
      '-b, --email-body-file <email-body-file>',
      {
        type: 'file', desc: 'File containing the html for the body of the email. Relative to the emailBodyFileDir directory you set in the configuration.', strinct: true
      }
    )
    .option(
      '-f, --from <sent-from-for-replies>',
      {
        type: 'string', desc: 'The value that the receiver will see that your emails appear to be sent from, in the form of "Kim <services@binarymist.net>"', strict: true
      }
    )
    .option(
      '-s, --subject <subject-for-email>',
      {
        type: 'string', desc: 'The subject for the email', strict: true
      }
    )
    .option(
      '-t, --schedule-time <time-to-schedule-email-send-for>',
      {
        type: 'mailgunDateTimeFormat', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true // As above, this is broken.
        //type: 'string', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true
      }
    )
    .option(
      '-tm, --test-mode',
      {
        type: 'boolean', desc: 'Whether or not to send in test mode "o:testmode".', strict: true, defaultValue: config.get('o:testmode')
      }
    )  // Todo: KC: If the following command call exists, then the schedule-delivery command is broken. Uncomment to run list.
/*  .command('list', {

    desc: 'List members in order based on latest or oldest mailgunMateScheduledSends datetimes.',
    paramsDesc: 'The order to list the items in: "des" for descending, "asc" for ascending.',
    setup: (sywac) => {
      sywac
      .option(
        '-l, --email-list <email-list>',
        {
          type: 'string', desc: 'The mailgun email list you would like to use.', strinct: true, defaultValue: config.get('emailList')
        }
      )
      .option(
        '-o, --order [des|asc(default)]',
        {
          type: 'string', desc: 'The order you would like the items displayed in.', defaultValue: config.get('displayOrderOfListMemberScheduledSends')
        }
      );
    },
    run: async (parsedArgv, context) => {
      const argv = parsedArgv;
      debugger;
      internals.listMemberDispalyOrder = argv.o;

      if (parsedArgv.l) {
        internals.mailList = parsedArgv.l;
      } else {
        return context.cliMessage('You must provide a valid mailgun mail list.');
      }

      internals.mgDomain = config.get('domain');
      console.log(`Your currently configured mailgun domain is "${internals.mgDomain}".`);
      console.log(`Your currently configured mailgun list is "${internals.mailList}".`);

      await authenticateToMailgun();
      debugger;
      await displaySubscribedListMembers();




      argv.handled = true;
    }


  })*/
  // Todo: KC: Following command should provide context sensitive help for the list command, but it doesn't work
  /*.command('*', {
    desc: 'Default command for schedule-delivery.',
    setup: (sywac) => {
      debugger;
      sywac.help('-h, --help').showHelpByDefault().parseAndExit();
    },
    run: (parsedArgv, context) => {
      debugger
      const argv = parsedArgv;

      if (context.args.length > 1) context.cliMessage(`Unknown argument: ${context.args[1]}`);

      context.helpRequested = true;

      return argv;
      //argv.handled = true;
    }
  })*/
  ;
};
exports.run = async (parsedArgv, context) => {
  const argv = parsedArgv;

  if (parsedArgv.l) {
    internals.mailList = parsedArgv.l;
  } else {
    return context.cliMessage('You must provide a valid mailgun mail list.');
  }

  if (parsedArgv.b) {
    // Get the file and validate it.
    const targetEmailBodyFilePath = `${config.get('emailBodyFileDir')}${parsedArgv.b}`;

    try {
      internals.emailProps.html = await readFileAsync(targetEmailBodyFilePath, { encoding: 'utf8' });
    } catch (err) {
      log.error(`Could not read file: ${targetEmailBodyFilePath}, the error was: ${err.message}.`);
      process.exit(9);
    }
    log.notice(`${config.get('appName')} has your file ${targetEmailBodyFilePath}`);
    internals.emailBodyFile = parsedArgv.b;
  } else {
    return context.cliMessage('You must provide a valid html file that exists relative to the emailBodyFileDir directory you set in the configuration to be used as the email body.');
  }

  if (parsedArgv.f) {
    internals.emailProps.from = parsedArgv.f;
  } else {
    return context.cliMessage('You must provide a valid "from" string.');
  }

  if (parsedArgv.s) {
    internals.emailProps.subject = parsedArgv.s;
  } else {
    return context.cliMessage('You must provide a valid subject.');
  }

  if (parsedArgv.t) {
    internals.emailProps['o:deliverytime'] = parsedArgv.t;
    // Todo: KC: Remove once the mailgunDateTimeFormat.validateValue is working. This currently allows any date.
    internals.scheduledSendDateTime = parsedArgv.t;
  } else {
    return context.cliMessage('You must provide a valid schedule time.');
  }

  if (typeof parsedArgv.tm === 'boolean') {
    internals.emailProps['o:testmode'] = parsedArgv.tm;
  } else {
    return context.cliMessage('You must provide a test mode of true or false.');
  }

  internals.mgDomain = config.get('domain');
  log.notice(`Your currently configured mailgun domain is "${internals.mgDomain}".`);
  log.notice(`Your currently configured mailgun list is "${internals.mailList}".`);

  await authenticateToMailgun();

  await establishSubscribedListMembersForSelection();

  // Todo: KC: Extract to method.
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

  await promptForTagsToAddToBatch();

  await internals.scheduleEmailBatch();

  // Todo: KC: deserialise configFileContents
  //    https://github.com/danivek/json-api-serializer looks to be well maintained.
  //    https://github.com/SeyZ/jsonapi-serializer     looks to be a little neglected.

  // Todo: KC: Validate object graph using Joi. Look at using the same validation in the Orchestrator as well.

  argv.handled = true;
};
