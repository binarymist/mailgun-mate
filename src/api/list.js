const config = require('config/config');
const log = require('purpleteam-logger').logger();
const commonApi = require('src/api/common');

const displaySubscribedListMembers = async () => {
  await commonApi.establishSubscribedListMembersAndSort((orderedDisplayableSubscribedListMembers) => {
    log.notice(`\n${'Ordered Subscribed Members'.padEnd(config.get('valueToSiblingFieldPadWidth'))}DateTime Scheduled` + '\n' + 
    orderedDisplayableSubscribedListMembers.reduce(
      (accumulated, member) => 
        `${accumulated}\n${`${member.address}`.padEnd(config.get('valueToSiblingFieldPadWidth'))}${member.latestScheduledSend}`
        , ''
    ));
  });
};


module.exports = {  
  displaySubscribedListMembers
};