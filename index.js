import Discord, { Client, Collection, EmbedBuilder, Partials } from "discord.js";
import config from "./config.json" with { type: 'json' };
import { GiveawaysManager } from "discord-giveaways";
import { startDashboard } from './Dashboard/server.js';

const bot = new Client({
    intents: 3276799,
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
    ]
});

bot.commands = new Collection();
bot.setMaxListeners(70);

global.Discord = Discord;

bot.on('ready', () => {
    console.log(`[INFO] > ${bot.user.tag} est connecté`);
    console.log(`[Invite] https://discord.com/oauth2/authorize?client_id=${bot.user.id}&permissions=8&scope=bot`);
    
    startDashboard();
});

bot.giveawaysManager = new GiveawaysManager(bot, {
    storage: './giveaways.json',
    updateCountdownEvery: 5000,
    default: {
        botsCanWin: false,
        embedColor: config.color,
        reaction: "🎉"
    }
});

bot.giveawaysManager.on('giveawayEnded', async (giveaway, winners) => {
    try {
        const channel = await bot.channels.fetch(giveaway.channelId);
        const message = await channel.messages.fetch(giveaway.messageId);

        const reaction = message.reactions.cache.get("🎉");
        let participantsCount = 0;
        if (reaction) {
            const users = await reaction.users.fetch();
            participantsCount = users.filter(u => !u.bot).size;
        }

        const embed = new EmbedBuilder()
            .setTitle(giveaway.prize)
            .setDescription(
                `Fin: <t:${Math.floor(giveaway.endAt / 1000)}:R>\n` +
                `Organisé par: ${giveaway.hostedBy}\n` +
                `Participants: ${participantsCount}\n` +
                `Gagnant(s): ${winners.map(w => `<@${w.id}>`).join(', ') || "Aucun"}`
            )
            .setColor(config.color);
        
        await message.edit({ embeds: [embed], components: [] });
    } catch (e) {
        console.error("Erreur fin giveaway:", e);
    }
});

const commandHandler = (await import('./Handler/Commands.js')).default(bot);
const eventdHandler = (await import('./Handler/Events.js')).default(bot);
const anticrashHandler = (await import('./Handler/anticrash.js')).default;
anticrashHandler(bot);

bot.login(config.token).catch((e) => {
    console.log('\x1b[31m[!] — Token invalide ou Intents mal configurés\x1b[0m');
});
