'use strict';

require('app-module-path').addPath(process.cwd());
const { describe, it } = exports.lab = require('lab').script();
const { expect } = require('code');
const sinon = require('sinon');
const rewire = require('rewire');

const config = require('config/config');
const log = require('purpleteam-logger').init(config.get('logger'));
const { scheduleDelivery: scheduleDeliveryApi, common: commonApi } = require('src/api');


// 'shot' for mocking http requests

describe('scheduleDelivery', async () => {

  describe('addChosenMembersToBatch', async () => {

    it('- given list of subscribed members - should establish recipient vars and return chosen subscribed members - based on user selected to addresses', async (flags) => {
    debugger;
      const listMembersAsJson = await commonApi.readFile(`${process.cwd()}/test/api/dummyMailList`);
      const listMembers = JSON.parse(listMembersAsJson);
      const subscribedListMembers = listMembers.filter(item => item.subscribed);

      const subscribedListMembersStub = sinon.stub(commonApi, 'subscribedListMembers');

      subscribedListMembersStub.returns(subscribedListMembers);


      const rewiredScheduleDeliveryApi = rewire('src/api/scheduleDelivery');
      const revertSubscribedListMembers =  rewiredScheduleDeliveryApi.__set__('commonApi', {subscribedListMembers: subscribedListMembersStub});

      const internalsEmailPropsTo = [
        '11993.lafitskaya2l@mail.ru',
        'a1rita@mmail.trade',
        'a2yubdzhonaverbukh1989984ubu@bk.ru',
        'b2enet@starlifterdigital.com',
        'c1ryptohelp8@mail.ru', // Not subscribed
        'xroum2jam@gmail.com'
      ];

      const revertEmailProps = rewiredScheduleDeliveryApi.__set__('internals', {emailProps: {to: internalsEmailPropsTo}});

      const rewiredAddChosenMembersToBatch = rewiredScheduleDeliveryApi.__get__('addChosenMembersToBatch');

      const chosenSubscribedListMembers = rewiredAddChosenMembersToBatch();

      const expectedChosenSubscribedListMembers = [
        {
          address: '11993.lafitskaya2l@mail.ru', 
          name: 'Francesca Chery',
          subscribed: true,
          vars: {
            mailgunMateScheduledSends: [
              [
                'a.html',
                '2018-06-14_13:01:44'
              ]
            ],
            fname: 'Francesca',
            name: 'Francesca Chery',
            notes: 'What a lovely name',
            org: 'Tree Cutters Ltd',
            role: 'arborist'
          }
        },
        {
          address: 'a1rita@mmail.trade',
          name: 'Celina Pegues',
          subscribed: true,
          vars: {}
        },
        {
          address: 'a2yubdzhonaverbukh1989984ubu@bk.ru',
          name: 'Etsuko Greenblatt',
          subscribed: true,
          vars: {
            fname: 'Etsuko',
            name: 'Etsuko Greenblatt',
            org: 'Health Society',
            role: 'Regional Manager'
          }
        },
        {
          address: 'b2enet@starlifterdigital.com',    
          name: 'Paris Ogawa',
          subscribed: true,    
          vars: {
            notes: 'Cats PJamas',
            fname: 'Ogawa',
            name: 'Paris Ogawa'
          }
        },
        // Not subscribed:
        //{
        //  "address": "c1ryptohelp8@mail.ru",
        //  "name": "Laurinda Negus",
        //  "subscribed": false,
        //  "vars": {}
        //},
        {
          address: 'xroum2jam@gmail.com',
          name: 'Johnette Humber',
          subscribed: true,
          vars: {
            name: 'Johnette Humber',
            mailgunMateScheduledSends: [
              [
                'a.html',
                '2018-06-14_13:01:44'
              ],
              [
                'b.html',
                '2018-06-14_19:27:00'
              ]
            ]
          }
        }
      ];
  
      expect(chosenSubscribedListMembers).to.equal(expectedChosenSubscribedListMembers);

      sinon.assert.calledOnce(subscribedListMembersStub);

      const expectedRecipientVars = {
        '11993.lafitskaya2l@mail.ru': {
          mailgunMateScheduledSends: [
            [
              'a.html',
              '2018-06-14_13:01:44'
            ]
          ],
          fname: 'Francesca',
          name: 'Francesca Chery',
          notes: 'What a lovely name',
          org: 'Tree Cutters Ltd',
          role: 'arborist'
        },
        'a1rita@mmail.trade': {},
        'a2yubdzhonaverbukh1989984ubu@bk.ru': {
          fname: 'Etsuko',
          name: 'Etsuko Greenblatt',
          org: 'Health Society',
          role: 'Regional Manager'
        },
        'b2enet@starlifterdigital.com': {
          notes: 'Cats PJamas',
          fname: 'Ogawa',
          name: 'Paris Ogawa'
        },
        'xroum2jam@gmail.com': {
          name: 'Johnette Humber',
          mailgunMateScheduledSends: [
            [
              'a.html',
              '2018-06-14_13:01:44'
            ],
            [
              'b.html',
              '2018-06-14_19:27:00'
            ]
          ]
        }
      };

      const actualRecipientVars =  rewiredScheduleDeliveryApi.__get__('internals.emailProps[\'recipient-variables\']');

      expect(actualRecipientVars).to.equal(expectedRecipientVars);

      flags.onCleanup = () => {
        debugger;
        revertSubscribedListMembers();
        revertEmailProps();
      };
    });

  });

});