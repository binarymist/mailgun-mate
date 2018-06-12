const readFileAsync = require('util').promisify(require('fs').readFile);
const inquirer = require('inquirer');
const emailCheckBoxPrompt = inquirer.createPromptModule();
const apiKeyPrompt = inquirer.createPromptModule();
const config = require('config/config');

const internals = {};














////////////////////////////////////////////////////////

exports.flags = 'list-bounces';
exports.description = 'List bounces, so you can remove or unsubscribe them.';
exports.setup = (sywac) => {
  debugger;
  
};
exports.run = async (parsedArgv, context) => {
  const argv = parsedArgv;
  
  if (parsedArgv._.length) {
    context.cliMessage('To many arguments provided, testplan requires 0 additional arguments.');
  } else {
    debugger;

    const mgDomain = config.get('domain');

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

    await internals.mailgun.bounces().list().then((data) => {

      debugger;
      //if (data.items.length > 0) {

        const bounces = data.items.map(item => `address: ${`${item.address},`.padEnd(30)} error: ${item.error}`);

        const reduced = bounces.reduce((combined, bounce) => `${combined}\n${bounce}` );


        console.log(reduced);
//      await Promise.all(combinedTestPlan)).reduce((combined, plan) => `${combined}\n\n${plan}`;

      //}
    }, (err) => {

      debugger;
    });




    console.log('Just called bounces...'); // eslint-disable-line no-console
  }





    // Todo: KC: deserialise configFileContents
    //    https://github.com/danivek/json-api-serializer looks to be well maintained.
    //    https://github.com/SeyZ/jsonapi-serializer     looks to be a little neglected.

    // Todo: KC: Validate object graph using Joi. Look at using the same validation in the Orchestrator as well.



  argv.handled = true;
};
