const config = require('config/config');
const log = require('purpleteam-logger').logger();
debugger;
const { list: listApi, common: commonApi } = require('src/api');
debugger;

exports.flags = `list [order=${config.get('displayOrderOfListMemberScheduledSends')}]`;
exports.desc = 'List members in order based on latest or oldest mailgunMateScheduledSends datetimes.';
exports.paramsDesc = 'The order to list the items in: "des" for descending, "asc" for ascending.';
exports.params = [{
  type: 'enum',
  choices: ['des', 'asc']
}];
exports.setup = (sywac) => {
  debugger;
  sywac  
  .option(
    '-l, --email-list <email-list>',
    {
      type: 'string', desc: 'The mailgun email list you would like to use.', defaultValue: config.get('emailList')
    }
  );
};  
exports.run = async (parsedArgv, context) => {      
  debugger;
  commonApi.setListMemberDispalyOrder(parsedArgv.order);      
  commonApi.setMailList(parsedArgv.l);   

  await commonApi.authenticateToMailgun();
  debugger;
  await listApi.displaySubscribedListMembers();
};
