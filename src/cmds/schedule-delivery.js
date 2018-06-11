const readFileAsync = require('util').promisify(require('fs').readFile);
const inquirer = require('inquirer');
const emailCheckBoxPrompt = inquirer.createPromptModule();
const apiKeyPrompt = inquirer.createPromptModule();
const config = require('config/config');




const internals = {emailProps: {}};





const establishSubscribedListMembers = async () => {
  debugger;
  const list = internals.mailgun.lists(internals.mailList);

  debugger;
  await list.info().then(
    function (data) {
      // `data` is mailing list info
      debugger;
      console.log(data);
    }, function (err) {
      debugger;
      console.log(`Retrieving mail list "${internals.mailList}" was unsuccessful. Error: {statusCode: ${err.statusCode}, message: ${err.message}}.`);
      process.exit(9);
    }
  );

  await list.members().list().then(
    function (members) {
      console.log('Authentication successful!');
      debugger;
      // `members` is the list of members
      console.log(members);  

   
      internals.subscribedListMembers = members.items.filter(item => item.subscribed)
      debugger;
      internals.candidates = internals.subscribedListMembers.map(member => ({name: `${member.name} <${member.address}>`, value: member.address}) )
    }, (err) => {
      debugger;
      if (err && err.statusCode === 401 && err.message === 'Unauthorized') {
        console.log('Authentication unsuccessful! Feel free to try again.');
        process.exit(9);
      }
      console.log(`Error occured while attempting to retrieve the mail list. Error was: "${err}"`);

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
    (data) => {
      debugger;
      console.log(data);
    }, (err) => {
      debugger;
    }
  );
};














////////////////////////////////////////////////////////

exports.flags = 'schedule-delivery';
exports.description = 'Launch scheduled mail delivery, max of three days in advance.';
exports.setup = (sywac) => {
  sywac.option(
    '-l, --email-list <email-list>',
    {
      type: 'string', desc: 'The mailgun email list you would like to use.', strinct: true, defaultValue: config.get('emailList')
    }
  )
  .option(
    '-b, --email-body-file <email-body-file-path>',
    {
      type: 'file', desc: 'File containing the html for the body of the email.', strinct: true, mustExist: true
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
      type: 'string', desc: 'The time that all emails will be sent.', strict: true
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
  
    try {
      internals.emailProps.html = await readFileAsync(parsedArgv.b, { encoding: 'utf8' });      
    } catch (err) {
      console.log(`Could not read file: ${parsedArgv.b}, the error was: ${err}`); // eslint-disable-line no-console
    }
    console.log(`I have your file ${parsedArgv.b}`); // eslint-disable-line no-console
  } else {
    return context.cliMessage('You must provide a valid html file that exists on the local file system to be used as the email body.');
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
  } else {
    return context.cliMessage('You must provide a valid schedule time.');
  }

  if (parsedArgv.tm) {
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
    message: 'Which list members would you like to target?',
    choices: internals.candidates,
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
