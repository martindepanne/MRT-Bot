import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';
import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./database.sqlite');

export const command = {
    name: 'fivem',
    sname: 'fivem',
    aliases: ['fx'],
    description: 'Affiche le statut détaillé du serveur FiveM',
    run: async (bot, message, args, config) => {

        const cfxId = args[0] || config.fivem_id;
        const discordLink = config.discord_link || "https://discord.gg/invite";

        if (!cfxId) return message.reply("`❌` Aucun ID FiveM trouvé.");

        const url = `https://servers-frontend.fivem.net/api/servers/single/${cfxId}`;

        try {
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = response.data.Data;
            const hostname = data.hostname.replace(/\^[0-9]/g, '').trim();

            const embed = new EmbedBuilder()
                .setTitle(`${hostname} - Statut serveur`)
                .setColor(config.color)
                .setThumbnail(`https://servers-live.fivem.net/servers/icon/${cfxId}.png`)
                .setDescription(
                    `**Connexion via F8**\n` +
                    `\`\`\`connect cfx.re/join/${cfxId}\`\`\`\n` +
                    `**${hostname}**\n` +
                    `\` 🟢 Online \` \n\n` +
                    `**Joueurs** ㅤㅤㅤㅤㅤㅤㅤ**Ping**\n` +
                    `\` ${data.clients}/${data.sv_maxclients} \` ㅤㅤㅤㅤ \` ${data.players[0]?.ping || 0} ms \``
                )
                .setFooter({ text: `@${hostname}`, iconURL: bot.user.displayAvatarURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Se connecter')
                    .setURL(`https://cfx.re/join/${cfxId}`)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji("🚀"),
                new ButtonBuilder()
                    .setLabel('Discord')
                    .setURL(discordLink)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji("🔗")
            );

            const sent = await message.channel.send({ embeds: [embed], components: [row] });

            db.run(`INSERT OR REPLACE INTO fivem_status (guildId, channelId, messageId, cfxId) VALUES (?, ?, ?, ?)`, 
                [message.guild.id, message.channel.id, sent.id, cfxId]);

            message.delete().catch(() => {});

        } catch (e) {
            message.reply("`❌` Erreur lors de l'envoi.");
        }
    }
};