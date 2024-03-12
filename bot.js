require('dotenv').config()
const fs = require('fs');
const { Client } = require('discord.js');
const auth = require('./authentication.js');
const connectionHandler = require('./connectionHandler.js');

const cachelength = 100; // Length of message history

const msghistory = new Map();
const client = new Client({ 
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
  intents: ['DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILDS']
}); // Using Intents for message events


client.user.setActivity('for people at https://discross.percs.dev', { type: 'WATCHING' });


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async function (msg) {
  if (msghistory.has(msg.channel.id) && !(msghistory.get(msg.channel.id).has(msg.id))) {
    msghistory.get(msg.channel.id).set(msg.id, msg);

    if (msghistory.get(msg.channel.id).size > cachelength) {
      const msgMap = msghistory.get(msg.channel.id);
      const keysToDelete = Array.from(msgMap.keys()).slice(0, msgMap.size - cachelength);
      for (const key of keysToDelete) {
        msgMap.delete(key);
      }
    }
  }

  if (msg.content === '^connect') {
    if (msg.webhookId) {
      msg.reply("you're already using Discross!");
    } else {
      msg.author.send('Verification code:\n`' + (await auth.createVerificationCode(msg.author.id)) + '`');
      msg.reply('you have been sent a direct message with your verification code.');
    }
  }

  connectionHandler.sendToAll(msg.content, msg.channel.id);
});

exports.startBot = async function () {
  client.login(process.env.DISCORD_TOKEN);
};

exports.addToCache = function (msg) {
  if (msghistory.has(msg.channel.id)) {
    msghistory.get(msg.channel.id).set(msg.id, msg);
  }
};

exports.getHistoryCached = async function (chnl) {
  if (!msghistory.has(chnl.id)) {
    const messageArray = await chnl.messages.fetch({ limit: cachelength });
    msghistory.set(chnl.id, messageArray.sort((messageA, messageB) => messageA.createdTimestamp - messageB.createdTimestamp));
  }
  return Array.from(msghistory.get(chnl.id).values());
};

exports.client = client;
