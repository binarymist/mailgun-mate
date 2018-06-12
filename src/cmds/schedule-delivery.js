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








const establishSubscribedListMembers = async () => {
  debugger;
  const list = internals.mailgun.lists(internals.mailList);
  internals.list = list;

  debugger;
  await list.info().then(
    function (data) {
      // `data` is mailing list info
      debugger;
      const { list: { access_level, address, created_at, description, members_count, name } } = data;
      console.log('Authentication successful!');
      console.log('Details for the list you selected follows:');
      console.log(`name: "${name}"\ndescription: "${description}"\nmembers_count: ${members_count}\naddress: "${address}"\naccess_level: "${access_level}"\ncreated_at: ${created_at}`);
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

  await list.members().list().then(
    function (members) {
      debugger;
      // `members` is the list of members
      console.log(members);  

   
      internals.subscribedListMembers = members.items.filter(item => item.subscribed)
      debugger;
      internals.candidatesForCheckListSelection = internals.subscribedListMembers.map(member => ({name: `${member.name} <${member.address}>`, value: member.address}) )
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
      console.log(data);

      // If was successfully received by mailgun, we need to update the recipientVars of the chosenSubscribedListMembers with the date and the name of the email body file.
      
      if (data.id && data.message === 'Queued. Thank you.') {
        console.log(`Emails were scheduled. Response from mailgun was:\nid: "${data.id}"\nmessage: "${data.message}"`);
        console.log('Now updating the following list Members:');
        chosenSubscribedListMembers.forEach(listMember => console.log(`${listMember.address} `));
        debugger;
        const scheduledSendToAdd = [`${internals.emailBodyFile}`, moment(internals.scheduledSendDateTime).format('YYYY-MM-DD_HH:mm:ss')];

        const prmoseOfUpdateListMembers = chosenSubscribedListMembers.map((memberRecord) => {

          return new Promise (async (resolve, reject) => {



            debugger;
            const newMemberRecord = memberRecord;
            newMemberRecord.subscribed = newMemberRecord.subscribed ? 'true' : 'false'; // Stupid hack cos mailgun expects the true or false to be strings, yet they provide the value as boolean.
            const mailgunMateScheduledSends = memberRecord.vars.mailgunMateScheduledSends ? memberRecord.vars.mailgunMateScheduledSends.concat([scheduledSendToAdd]) : [scheduledSendToAdd];
            newMemberRecord.vars.mailgunMateScheduledSends = mailgunMateScheduledSends;

            await internals.list.members(memberRecord.address).update(newMemberRecord)
              .then((data) => {
                debugger;
                console.log(`address: ${`${data.member.address},`.padEnd(30)} message: ${data.message}`);
                resolve(`Resolved promise for memberRecord ${newMemberRecord}`);
              }, (err) => {
                debugger;
                reject(err);
              });
            debugger;



          }); // End of promise

    
        });
        debugger;
        await Promise.all(prmoseOfUpdateListMembers).catch(reason => console.log(reason.message));

      }

    }, (err) => {
      console.log(`There was a problem scheduling the eamils. The error was: ${err}`);
      debugger;
    }
  );
};





















////////////////////////////////////////////////////////

exports.flags = 'schedule-delivery';
exports.description = 'Launch scheduled mail delivery, max of three days in advance.';
exports.setup = (sywac) => {
  debugger;
  sywac
  .registerFactory('mailgunDateTimeFormat', opts => new mailgunDateTimeFormat(opts))
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
      type: 'mailgunDateTimeFormat', desc: 'The time that all emails will be sent (in RFC 2822 time).', strict: true
    }
  )
  .option(
    '-tm, --test-mode',
    {
      type: 'boolean', desc: 'Whether or not to send in test mode "o:testmode".', strict: true, defaultValue: config.get('o:testmode')
    }
  );
};
exports.run = async (parsedArgv, context) => {
  const argv = parsedArgv;
  let subject;
  let sendTime;

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
  const mgDomain = config.get('domain');
  console.log(`Your currently configured mailgun domain is "${mgDomain}".`);

  debugger;
  await apiKeyPrompt({
    type: 'password',
    name: 'apiKey',
    message: 'Please enter your mailgun apiKey.'
    
  }).then((answer) => {
      debugger;

      internals.mailgun = require('mailgun-js')({apiKey: answer.apiKey, domain: mgDomain})
    }, (err) => {
      console.log(err);
    }
  );
  debugger;




  await establishSubscribedListMembers();

  await emailCheckBoxPrompt({
    type: 'checkbox',
    name: 'targetEmailAddresses',
    message: 'Which list members would you like to target? You can select up to 1000.',
    choices: internals.candidatesForCheckListSelection,
    pageSize: 20
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
