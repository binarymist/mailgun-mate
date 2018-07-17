# mailgun-mate

Email batch scheduling CLI. Code is currently in proof of concept (PoC) form.

[![Build Status](https://api.travis-ci.org/binarymist/mailgun-mate.png)](https://travis-ci.org/binarymist/mailgun-mate) &nbsp; [![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/binarymist/maailgun-mate)

## Install

```
npm i mailgun-mate -g
```
Or:

```
git clone git@github.com:binarymist/mailgun-mate.git && cd mailgun-mate && npm install
```
Before running, you'll need to setup a little configuration. See the [Configuration](#configuration) section below.


## Quick Start

First, you need to have a free mailgun account, a domain setup there, and at least one mail list to start controlling.

### Configuration

This project uses [convict](https://github.com/mozilla/node-convict). The configuration file(s) are in [`./config/`](https://github.com/binarymist/mailgun-mate/tree/master/config).

Decide on a directory that you will put your text files containing `HTML` (although just text is also fine), and assign that directory path to your config file's `emailBodyFileDir` property.  
In your `HTML` mailout files, you can add an unsubscribe link 

Mailgun [provides the ability](https://app.mailgun.com/app/domains/mailgun.yourdomain.com) for you to have them insert an `unsubscribe` link into all emails sent from your your domain. This link allows the email receiver to unsubscribe from the specific list that the email was sent from.  
In many cases you wont want an `unsubscribe` link, like when sending immediately or scheduling a small batch of custom mailouts from a large list of say business contacts, as these are usually fairly personal.  
The only option I've found that works on a email by email basis is inserting the following:

```
<a href="%unsubscribe_url%">unsubscribe from domain</a> <!--This link unsubscribes the member from the entire domain.-->
```

Clicking on that will unsubscribe the list member from the entire domain, which is usually not what you may want, especially if you have many lists.

Before sending any batch, I like to make sure I have `o:testmode` set to `true`, and I'm targeting a test `emailList`. Both of these can be set in the config file(s), but are also overrideable at the command line.  
you can change these once you're confident your configuration, command line args, email teamplate, and recipient variables are correct.  
I usually use a first name (`fname` in my case), then build up your email teamplate using a `%recipient.fname%` wich mailgun will substitute for the `fname` property you set in the list members recipient variables. The following is an example of how I setup the mailgun recipient variables.

```
{
  "fname": "Bob",
  "mailgunMateScheduledSends": [
    [
      "a.html",
      "2018-06-16_17:00:00"
    ],
    [
      "b.html",
      "2018-06-16_17:10:00"
    ]
  ],
  "name": "Bob Builder",
  "org": "Bob Builder Holdings",
  "role": "Carpenter"
}
```

The `mailgunMateScheduledSends` is what mailgun-mate adds for you. Each time you schedule an email, a new array containing the `email-body-file` and the `schedule-time` will be added to the `mailgunMateScheduledSends` array. Mailgun-mate knows where to find the`email-body-file` due to the `emailBodyFileDir` that you need to set in the configuration file.

The `name` property is printed beside the email address in `mailgun-mate`. `org` and `role` will be used to sort in the future.


## Usage

### Command Line

```
Usage: mailgun-mate [command(s)] [option(s)]

Options:
  -a, --about               Show about screen.
  -v, --version             Show version number.
  -h, --help                Show help.

Commands:
  schedule-delivery         Launch scheduled mail delivery, max of three days in advance.

Options:
  -l, --email-list      <email-list>                     The mailgun email list you would like to use.
  -b, --email-body-file <email-body-file>                File containing the html for the body of the email. Relative to the emailBodyFileDir directory you set in the configuration.
  -f, --from <sent-from-for-replies>                     The value that the receiver will see that your emails appear to be sent from, in the form of "Kim <services@binarymist.net>"
  -s, --subject <subject-for-email>'                     The subject for the email
  -t, --schedule-time <time-to-schedule-email-send-for>  The time that all emails will be sent (in RFC 2822 time).
  -tm, --test-mode                                       Whether or not to send in test mode "o:testmode". defaultValue set in config file.

Options:
  -h, --help                     Show help.

Commands:
  schedule-delivery list         List members in order based on latest or oldest mailgunMateScheduledSends datetimes.

Options:
  -h, --help                                    Show help.
  -l, --email-list          <email-list>        The mailgun email list you would like to use. A required string argument, if none is present on command line, value from config file is used.
  -o, --order              [des|asc(default)]   The order you would like the items displayed in.
```

Before authenticating with mailgun, `mailgun-mate` checks the `${os.homedir()}/.mailgun/key` for your private key, if present, it will attempt authentication, if not present, it will prompt for your key at the terminal. Currently there is no validation on your private key file ownership or permissions, but they should be set at least as restrictive as SSH private keys.

### Debugging

From within your `mailgun-mate` source directory, run the following and open your chrome dev tools:

```
node --inspect-brk ./bin/mailgun-mate [command(s)] [option(s)]
```

Or

```
npm run debug
```

If you need to pass arguments:

```
npm run debug -- [command(s)] [option(s)]
```

## Contribution

Please open an [issue](https://github.com/binarymist/mailgun-mate/issues) to discus the proposed change before submitting a [pull request](https://github.com/binarymist/mailgun-mate/pulls).

## License

Copyright [Kim Carter](https://github.com/binarymist) and other contributors, Licensed under [MIT](./LICENSE).

[mailgun-js]: https://github.com/bojand/mailgun-js

