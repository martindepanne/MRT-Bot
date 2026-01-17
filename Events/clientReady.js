import { ActivityType, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import axios from 'axios';
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('../database.sqlite3');

export default {
    name: Events.ClientReady, 
    once: true, 
    async execute(bot) {
        
        db.run(`CREATE TABLE IF NOT EXISTS fivem_status (
            guildId TEXT PRIMARY KEY,
            channelId TEXT,
            messageId TEXT,
            cfxId TEXT
        )`);

        if (bot.arrayOfSlashCommands) {
            await bot.application.commands.set(bot.arrayOfSlashCommands);
        }

        bot.user.setPresence({
            activities: [{ 
                name: 'MRT-Bot', 
                type: ActivityType.Watching, 
                url: 'https://guns.lol/martindepanne' 
            }], 
            status: 'online'
        });

        /* DÉTAILS DES TYPES D'ACTIVITÉS (ActivityType) :
           - ActivityType.Playing   : "Joue à..."
           - ActivityType.Streaming : "En direct sur..." 
           - ActivityType.Listening : "Écoute..."
           - ActivityType.Watching  : "Regarde..."
           - ActivityType.Competing : "Participe à..."

           DÉTAILS DES STATUTS (status) :
           - 'online'    : En ligne
           - 'idle'      : Inactif (AFK)
           - 'dnd'       : Ne pas déranger
           - 'invisible' : Apparaît hors-ligne
        */

        setInterval(async () => {
            db.all(`SELECT * FROM fivem_status`, async (err, rows) => {
                if (err || !rows) return;

                for (const row of rows) {
                    try {
                        const start = Date.now();
                        const response = await axios.get(`https://servers-frontend.fivem.net/api/servers/single/${row.cfxId}`, {
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        const data = response.data.Data;
                        const ping = Date.now() - start;

                        const guild = bot.guilds.cache.get(row.guildId);
                        const channel = await guild?.channels.fetch(row.channelId).catch(() => null);
                        const msg = await channel?.messages.fetch(row.messageId).catch(() => null);
                        if (!msg) continue;

                        const hostname = data.hostname.replace(/\^[0-9]/g, '').trim();

                        const newEmbed = new EmbedBuilder()
                            .setTitle(`${hostname} - Statut serveur`)
                            .setColor(msg.embeds[0].color)
                            .setThumbnail(`https://servers-live.fivem.net/servers/icon/${row.cfxId}.png`)
                            .setDescription(
                                `**Connexion via F8**\n` +
                                `\`\`\`connect cfx.re/join/${row.cfxId}\`\`\`\n` +
                                `**${hostname}**\n` +
                                `\` 🟢 Online \` \n\n` +
                                `**Joueurs** ㅤㅤㅤㅤㅤㅤㅤ**Ping**\n` +
                                `\` ${data.clients}/${data.sv_maxclients} \` ㅤㅤㅤㅤ \` ${data.players[0]?.ping || 0} ms \``
                            )
                            .setFooter({ text: `@${hostname}`, iconURL: bot.user.displayAvatarURL() })
                            .setTimestamp();

                        const buttons = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('Se connecter')
                                .setURL(`https://cfx.re/join/${row.cfxId}`)
                                .setStyle(ButtonStyle.Link)
                                .setEmoji("🚀"),
                            new ButtonBuilder()
                                .setLabel('Discord')
                                .setURL(bot.config.discord_link || "https://discord.gg/invite")
                                .setStyle(ButtonStyle.Link)
                                .setEmoji("🔗")
                        );

                        await msg.edit({ embeds: [newEmbed], components: [buttons] });

                    } catch (error) {
                        continue;
                    }
                }
            });
        }, 60000);

        console.log(`[READY] ${bot.user.tag} est opérationnel.`);
    }
};