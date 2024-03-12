var fs = require('fs');
var minify = require('html-minifier').minify;
var escape = require('escape-html');

// Minify at runtime to save data on slow connections, but still allow editing the unminified file easily
// Is that a bad idea?

// Templates for viewing the channels in a server
const server_template = minify(fs.readFileSync('pages/templates/server.html', 'utf-8'));

const text_channel_template = minify(fs.readFileSync('pages/templates/channellist/textchannel.html', 'utf-8'));
const voice_channel_template = minify(fs.readFileSync('pages/templates/channellist/voicechannel.html', 'utf-8'));
const category_channel_template = minify(fs.readFileSync('pages/templates/channellist/categorychannel.html', 'utf-8'));

const server_icon_template = minify(fs.readFileSync('pages/templates/server/server_icon.html', 'utf-8'));

const invalid_server_template = minify(fs.readFileSync('pages/templates/server/invalid_server.html', 'utf-8'));

const cachedMembers = {}; // TODO: Find a better way

function strReplace(string, needle, replacement) {
  return string.split(needle).join(replacement||"");
};

// https://stackoverflow.com/questions/1967119/why-does-javascript-replace-only-first-instance-when-using-replace

exports.processServer = async function (bot, req, res, args, discordID) {
  guestServers = ["439461201731387392"];
  guestChannels = ["608958017366654986"];
  var isGuest = false;
  if (typeof(discordID) == "object") {
    isGuest = true;
  }
  serverList = "";
  for (var server of bot.client.guilds.cache) {
    server = server[1];
    if (cachedMembers[discordID] && cachedMembers[discordID][server.id] !== undefined) {
      member = cachedMembers[discordID][server.id];
    } else if (!(isGuest && guestServers.includes(server.id))) {
      try {
        member = await server.members.fetch(discordID);
      } catch (err) {
        member = null;
      }
      if (!cachedMembers[discordID]) {
        cachedMembers[discordID] = {};
      }
      cachedMembers[discordID][server.id] = member;
    }
    if ((isGuest && guestServers.includes(server.id)) || (member && member.user)) {
      serverHTML = strReplace(server_icon_template, "{$SERVER_ICON_URL}", server.iconURL());
      serverHTML = strReplace(serverHTML, "{$SERVER_URL}", "./" + server.id);
      serverList += serverHTML;
    }
  }

  response = server_template.replace("{$SERVER_LIST}", serverList);

  server = bot.client.guilds.cache.get(args[2]);

  try {
    if (!(isGuest && guestServers.includes(server.id))) {
      member = await server.members.fetch(discordID);
      user = member.user;
      username = user.tag;
      if (member.displayName != user.username) {
        username = member.displayName + " (@" + user.tag + ")";
      }
    }
    //} else {
     // username = "Guest";
    //}
    // username = 
    if (!((isGuest && guestServers.includes(server.id)) || member.user)) {
      server = undefined;
    }
  } catch (err) { // If they aren't in the server
    // console.log(err); TODO: Only ignore TypeError: Cannot read property 'members' of undefined
    server = undefined; // Act like it doesn't exist 
  }

  let channelList = "";
  if (server) {
    const categories = server.channels.cache.filter(channel => channel.type == "GUILD_CATEGORY");
    const categoriesSorted = categories.sort((a, b) => (a.position - b.position));

    let channelsSorted = server.channels.cache.filter(channel => channel.type != "GUILD_CATEGORY" && !channel.parent); // Start with lone channels (no category)
    channelsSorted = channelsSorted.sort((a, b) => (a.position - b.position));

    categoriesSorted.forEach(function (category) {
      channelsSorted.set(category.id, category);
      channelsSorted = channelsSorted.concat(
        category.children.sort((a, b) => (a.position - b.position))
          .filter(channel => channel.type != "GUILD_VOICE")
      );
    });

    channelsSorted.forEach(function (item) {
      if ((isGuest && guestChannels.includes(item.id)) || (member.permissionsIn && member.permissionsIn(item).has("VIEW_CHANNEL", true))) {
        if (item.type == "GUILD_CATEGORY") {
          channelList += category_channel_template.replace("{$CHANNEL_NAME}", escape(item.name));
        } else if (item.type == "GUILD_VOICE") {
          channelList += voice_channel_template.replace("{$CHANNEL_NAME}", escape(item.name)).replace("{$CHANNEL_LINK}", "../channels/" + item.id + "#end");
        } else {
          channelList += text_channel_template.replace("{$CHANNEL_NAME}", escape(item.name)).replace("{$CHANNEL_LINK}", "../channels/" + item.id + "#end");
        }
      }
    });
  } else {
    channelList = invalid_server_template;
  }

  response = response.replace("{$CHANNEL_LIST}", channelList);

  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(response);
  res.end();
}
