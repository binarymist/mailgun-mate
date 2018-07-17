const readFileAsync = require('util').promisify(require('fs').readFile);
const inquirer = require('inquirer');
const createMailgun = require('mailgun-js');
const os = require('os');
const config = require('config/config');
const log = require('purpleteam-logger').logger();

const apiKeyPrompt = inquirer.createPromptModule();

const internals = {
  mgDomain: config.get('domain')
};

log.notice(`Your currently configured mailgun domain is "${internals.mgDomain}".`);


const displayListInfo = async () => {
  internals.list = internals.mailgun.lists(internals.mailList);

  await internals.list.info().then((data) => {
    // `data` is mailing list info
    const {
      list: {
        access_level, address, created_at, description, members_count, name // eslint-disable-line camelcase
      }
    } = data;
    log.notice('Authentication successful!');
    log.notice('Details for the list you selected follows:');
    log.notice(`name: "${name}"\ndescription: "${description}"\nmembers_count: ${members_count} (subscribed and unsubscribed inclusive). Only the subscribed are listed below. \naddress: "${address}"\naccess_level: "${access_level}"\ncreated_at: ${created_at}`); // eslint-disable-line camelcase
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

  await internals.list.members().pages().page({ subscribed: true, limit: mailgunMaxPageSize }).then(async (list) => {
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


module.exports = {
  authenticateToMailgun,
  establishSubscribedListMembersAndSort,
  subscribedListMembers: () => internals.subscribedListMembers,
  mailgun: () => internals.mailgun,
  list: () => internals.list,
  setListMemberDispalyOrder: (listMemberDispalyOrder) => { internals.listMemberDispalyOrder = listMemberDispalyOrder; },
  setMailList: (mailList) => {
    internals.mailList = mailList;
    log.notice(`Your currently configured mailgun list is "${internals.mailList}".`);
  },
  readFile: async (filePath) => {
    try {
      return await readFileAsync(filePath, { encoding: 'utf8' });
    } catch (err) {
      log.error(`Could not read file: ${filePath}, the error was: ${err.message}.`);
      process.exit(9);
    }
    return undefined;
  }
};
