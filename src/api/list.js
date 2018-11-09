const config = require('../../config/config');
const log = require('purpleteam-logger').logger();
const commonApi = require('./common');

const displaySubscribedListMembers = async () => {
  await commonApi.establishSubscribedListMembersAndSort((orderedDisplayableSubscribedListMembers) => {
    // eslint-disable-next-line prefer-template
    log.notice(`\n${'Ordered Subscribed Members'.padEnd(config.get('valueToSiblingFieldPadWidth'))}DateTime Scheduled\n` +
    orderedDisplayableSubscribedListMembers.reduce((accumulated, member) => `${accumulated}\n${`${member.address}`.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`, ''));
  });
};


module.exports = { displaySubscribedListMembers };
