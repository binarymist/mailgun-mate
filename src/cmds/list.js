const config = require('config/config');
const log = require('purpleteam-logger').logger();
debugger;
const { list: listApi, common: commonApi } = require('src/api');
debugger;

exports.flags = 'list';
exports.desc = 'List members in order based on latest or oldest mailgunMateScheduledSends datetimes.';
exports.paramsDesc = 'The order to list the items in: "des" for descending, "asc" for ascending.',
exports.setup = (sywac) => {
  debugger;
  sywac  
  .option(
    '-l, --email-list <email-list>',
    {
      type: 'string', desc: 'The mailgun email list you would like to use.', defaultValue: config.get('emailList')
    }
  )
  .option(
    '-o, --order [des|asc(default)]',
    {
      type: 'string', desc: 'The order you would like the items displayed in.', defaultValue: config.get('displayOrderOfListMemberScheduledSends')
    }
  );
};  
exports.run = async (parsedArgv, context) => {      
  debugger;
  commonApi.setListMemberDispalyOrder(parsedArgv.o);      
  commonApi.setMailList(parsedArgv.l);   

  await commonApi.authenticateToMailgun();
  debugger;
  await listApi.displaySubscribedListMembers();
};
