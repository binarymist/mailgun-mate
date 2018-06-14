const readFileAsync = require('util').promisify(require('fs').readFile);
const inquirer = require('inquirer');
const emailCheckBoxPrompt = inquirer.createPromptModule();
const apiKeyPrompt = inquirer.createPromptModule();
const config = require('config/config');

const moment = require('moment');

const Type = require('sywac/types/type')

const internals = {emailProps: {}};


class mailgunDateTimeFormat extends Type {
  get datatype () {
    return 'mailgunDateTimeFormat'
  }
  setValue (context, value) {
    
    debugger;
    context.assignValue(this.id, value);
  }
  validateValue (value) {
    debugger;
    // https://momentjs.com/docs/#/parsing/string-format/
    const scheduledTime = moment(value, config.get('mailgunTimeFormat'))
    internals.scheduleDateIsValid = scheduledTime.isValid();
    if (!internals.scheduleDateIsValid) return false;
    internals.scheduleDateIsBeforeDeadline = scheduledTime.isBefore(moment().add(config.get('mailgunMaxFutureScheduleInDays'), 'days'));
    if (!internals.scheduleDateIsBeforeDeadline) return false;
    internals.scheduleDateIsAfterNow = scheduledTime.isAfter(moment());
    if (!internals.scheduleDateIsAfterNow) return false;

    internals.scheduledSendDateTime = value;
    return true;
  }
  buildInvalidMessage (context, msgAndArgs) {
    let customMessage;
    debugger;
    super.buildInvalidMessage(context, msgAndArgs);

    if (!internals.scheduleDateIsValid) customMessage = `The datetime you entered was not valid according to mailgun\'s rules. RFC 2822, formatted as mailgun requires "${config.get('mailgunTimeFormat')}", See (https://documentation.mailgun.com/en/latest/user_manual.html#scheduling-delivery) for more information.`;
    else if (!internals.scheduleDateIsBeforeDeadline) customMessage = `The datetime you entered was outside of the mailgun ${config.get('mailgunMaxFutureScheduleInDays')} days schedule linmmit.`;
    else if (!internals.scheduleDateIsAfterNow) customMessage = `The datetime you entered was in the past.`;
    msgAndArgs.msg += ` Please specify a valid schedule datetime. ${customMessage} Please try again.`
  }
}


const displayListInfo = async () => {
  debugger;
  internals.list = internals.mailgun.lists(internals.mailList);

  debugger;
  await internals.list.info().then(
    function (data) {
      // `data` is mailing list info
      debugger;
      const { list: { access_level, address, created_at, description, members_count, name } } = data;
      console.log('Authentication successful!');
      console.log('Details for the list you selected follows:');
      console.log(`name: "${name}"\ndescription: "${description}"\nmembers_count: ${members_count} (subscribed and unsubscribed inclusive) \naddress: "${address}"\naccess_level: "${access_level}"\ncreated_at: ${created_at}`);
    }, function (err) {
      debugger;
      if (err && err.statusCode === 401 && err.message === 'Unauthorized') {
        console.log('Authentication unsuccessful! Feel free to try again.');
        console.log(`Retrieving mail list "${internals.mailList}" was unsuccessful. Error: {statusCode: ${err.statusCode}, message: ${err.message}}.`);
        process.exit(9);
      }
      console.log(`Error occured while attempting to retrieve the mail list info. Error was: "${err}"`);
    }
  );

};









const displaySubscribedListMembers = async () => {
  debugger
  await establishSubscribedListMembersAndSort( (orderedDisplayableSubscribedListMembers) => {
    debugger





    console.log(`\n${'Ordered Subscribed Members'.padEnd(config.get('valueToSiblingFieldPadWidth'))}DateTime Scheduled` + '\n' + 
    orderedDisplayableSubscribedListMembers.reduce( 
      (accumulated, member) => 
        `${accumulated}\n${`${member.address}`.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`
        , ''
    ));
    

  });

};




const establishSubscribedListMembersAndSort = async (workWithListMembersOnceEstablished) => {
  debugger;
  await displayListInfo();
  const mailgunMaxPageSize = 100;
  let listMembers;


  await internals.list.members().pages().page({subscribed: true, limit: mailgunMaxPageSize}).then(
    async function (list) {
      debugger;

      listMembers = list.items;
      let nextPage = list.paging.next.split('https://api.mailgun.net/v3')[1];

      while (nextPage) {
        debugger
      
        await internals.mailgun.get(nextPage).then(
          (page) => {
            debugger;
            // Todo: KC: Test with list > 200 members and teast with a list of 0 members.
            nextPage = page.items.length === mailgunMaxPageSize ? page.paging.next.split('https://api.mailgun.net/v3')[1] : null;
            listMembers = listMembers.concat(page.items);
          }, (err) => {
            debugger;
            console.log(`There was a problem getting subsequent pages from the mail list. The error was: ${err}`);
            process.exit(9);
          }
        );
      }

      internals.subscribedListMembers = listMembers;
      debugger;


      // Now we need to order listMembers based on the mailgunMateScheduledSends date.
      const theyAreTheSame = 0;
      const aIsLessThanB = -1;
      const aIsGreaterThanB = 1;
      const dateTimePart = 1;

      let displayDate;

      const displayableSubscribedListMembers = internals.subscribedListMembers.map((listMember) => {
        if (listMember.vars.mailgunMateScheduledSends) {
          const dateTimes = listMember.vars.mailgunMateScheduledSends.map( scheduledSend => scheduledSend[dateTimePart] );
          const sortedDateTimes = dateTimes.sort();
          const greatestDateTime = sortedDateTimes[sortedDateTimes.length -1];
          displayDate = greatestDateTime;
        } else {
          displayDate = '';
        }
        return { address: listMember.address, latestScheduledSend: displayDate, name: listMember.name };
      });    

      let orderedDisplayableSubscribedListMembers = displayableSubscribedListMembers.sort((a, b) => {
        if (a.latestScheduledSend < b.latestScheduledSend) return aIsLessThanB;
        if (a.latestScheduledSend > b.latestScheduledSend) return aIsGreaterThanB;
        return theyAreTheSame;
      });

      if (internals.listMemberDispalyOrder === 'des') orderedDisplayableSubscribedListMembers.reverse();



      debugger;
      workWithListMembersOnceEstablished(orderedDisplayableSubscribedListMembers);
      debugger;

    }, (err) => {
      debugger;
      if (err && err.statusCode === 401 && err.message === 'Unauthorized') {
        console.log('Authentication unsuccessful! Feel free to try again.');
        console.log(`Retrieving mail list mebers was unsuccessful. Error: {statusCode: ${err.statusCode}, message: ${err.message}}.`);
        process.exit(9);
      }
      console.log(`Error occured while attempting to retrieve the mail list members. Error was: "${err}"`);
    }
  );
};



const establishSubscribedListMembersForSelection = async () => {
  await establishSubscribedListMembersAndSort( (orderedDisplayableSubscribedListMembers) => {
    internals.candidatesForCheckListSelection = orderedDisplayableSubscribedListMembers.map(member => ({name: `${member.name.padEnd(config.get('valueToSiblingFieldPadWidth'))} ${member.address.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`, value: member.address}) );
  });
};




internals.scheduleEmailBatch = async () => {
  debugger;

  const recipientVars = {};

  const chosenSubscribedListMembers = internals.subscribedListMembers.filter((subscribedListMember) => {
    return internals.emailProps.to.some(
      (toAddress) => {
        return toAddress === subscribedListMember.address
      }
    );
  });

  chosenSubscribedListMembers.forEach(member => {
    recipientVars[member.address] = member.vars;
  });
  
  internals.emailProps['recipient-variables'] = recipientVars;
  debugger;

  await internals.mailgun.messages().send(internals.emailProps).then(
    async (data) => {
      debugger;

      // If was successfully received by mailgun, we need to update the recipientVars of the chosenSubscribedListMembers with the date and the name of the email body file.
      
      if (data.id && data.message === 'Queued. Thank you.') {
        console.log(`Emails were scheduled. Response from mailgun was:\nid: "${data.id}"\nmessage: "${data.message}"`);
        console.log('Now updating the following list Members:');
        chosenSubscribedListMembers.forEach(listMember => console.log(`${listMember.address} `));
        debugger;
        // Todo: KC: Currently internals.scheduledSendDateTime is being assigned in the run routine, as the mailgunDateTimeFormat.validateValue is broken.
        // So currently no datetime validation. If date is entered in the past, the eamil will be sent immediatly, but recorded as being sent in the past at the time that was given to mailgun-mate.
        const scheduledSendToAdd = [`${internals.emailBodyFile}`, moment(internals.scheduledSendDateTime).format('YYYY-MM-DD_HH:mm:ss')];

        const promiseOfUpdateListMembers = chosenSubscribedListMembers.map((memberRecord) => {

          return new Promise (async (resolve, reject) => {



            debugger;
            const newMemberRecord = memberRecord;
            newMemberRecord.subscribed = newMemberRecord.subscribed ? 'true' : 'false'; // Stupid hack cos mailgun expects the true or false to be strings, yet they provide the value as boolean.
            const mailgunMateScheduledSends = memberRecord.vars.mailgunMateScheduledSends ? memberRecord.vars.mailgunMateScheduledSends.concat([scheduledSendToAdd]) : [scheduledSendToAdd];
            newMemberRecord.vars.mailgunMateScheduledSends = mailgunMateScheduledSends;

            await internals.list.members(memberRecord.address).update(newMemberRecord)
              .then((data) => {
                debugger;
                console.log(`address: ${`${data.member.address},`.padEnd(config.get('valueToSiblingFieldPadWidth'))} message: ${data.message}`);
                resolve(`Resolved promise for memberRecord ${newMemberRecord}`);
              }, (err) => {
                debugger;
                reject(err);
              });
            debugger;



          }); // End of promise

    
        });
        debugger;
        await Promise.all(promiseOfUpdateListMembers).catch(reason => console.log(reason.message));

      }

    }, (err) => {
      console.log(`There was a problem scheduling the eamils. The error was: ${err}`);
      debugger;
    }
  );
};


const authenticateToMailgun = async () => {

  debugger;
  await apiKeyPrompt({
    type: 'password',
    name: 'apiKey',
    message: 'Please enter your mailgun apiKey.'
    
  }).then((answer) => {
      debugger;

      internals.mailgun = require('mailgun-js')({apiKey: answer.apiKey, domain: internals.mgDomain})
    }, (err) => {
      console.log(err);
    }
  );
};


















////////////////////////////////////////////////////////

exports.flags = 'schedule-delivery';
exports.description = 'Launch scheduled mail delivery, max of three days in advance.';
exports.setup = (sywac) => {
  debugger;
  sywac
// Todo: KC: .registerFactory('mailgunDateTimeFormat', opts => new mailgunDateTimeFormat(opts)) // Currently breaks https://github.com/sywac/sywac/issues/21
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
      //type: 'mailgunDateTimeFormat', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true // As above, this is broken.
      type: 'string', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true
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
          type: 'string', desc: 'Which order would you like the items displayed in.', defaultValue: config.get('displayOrderOfListMemberScheduledSends')
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
  debugger;
  const argv = parsedArgv;
  let subject;  

  if (parsedArgv.l) {
    internals.mailList = parsedArgv.l;  
  } else {
    return context.cliMessage('You must provide a valid mailgun mail list.');
  }

  if (parsedArgv.b) {
    // Get the file and validate it.
    debugger;
    const targetEmailBodyFilePath = `${config.get('emailBodyFileDir')}${parsedArgv.b}`;
  
    try {
      internals.emailProps.html = await readFileAsync(targetEmailBodyFilePath, { encoding: 'utf8' });      
    } catch (err) {
      console.log(`Could not read file: ${targetEmailBodyFilePath}, the error was: ${err.message}.`); // eslint-disable-line no-console
      process.exit(9);
    }
    console.log(`${config.get('appName')} has your file ${targetEmailBodyFilePath}`); // eslint-disable-line no-console
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
    debugger;
    internals.emailProps['o:deliverytime'] = parsedArgv.t;
    // Todo: KC: Remove once the mailgunDateTimeFormat.validateValue is working.
    internals.scheduledSendDateTime = parsedArgv.t;
  } else {
    debugger;
    return context.cliMessage('You must provide a valid schedule time.');
  }

  if (typeof parsedArgv.tm === 'boolean') {
    debugger;
    internals.emailProps['o:testmode'] = parsedArgv.tm;
  } else {
    return context.cliMessage('You must provide a test mode of true or false.');
  }
  debugger;
  internals.mgDomain = config.get('domain');
  console.log(`Your currently configured mailgun domain is "${internals.mgDomain}".`);
  console.log(`Your currently configured mailgun list is "${internals.mailList}".`);

  await authenticateToMailgun();
  debugger;




  await establishSubscribedListMembersForSelection();

  await emailCheckBoxPrompt({
    type: 'checkbox',
    name: 'targetEmailAddresses',
    message: 'Which list members would you like to target? You can select up to 1000.',
    choices: internals.candidatesForCheckListSelection,
    pageSize: config.get('pageSizeOfCandidatesForCheckListSelection')
  }).then((answers) => {
      debugger;
      internals.emailProps.to = answers.targetEmailAddresses;
    }, (err) => {
      debugger;
      console.log(err);
    }
  );

  await internals.scheduleEmailBatch();







    // Todo: KC: deserialise configFileContents
    //    https://github.com/danivek/json-api-serializer looks to be well maintained.
    //    https://github.com/SeyZ/jsonapi-serializer     looks to be a little neglected.

    // Todo: KC: Validate object graph using Joi. Look at using the same validation in the Orchestrator as well.



  argv.handled = true;
};
