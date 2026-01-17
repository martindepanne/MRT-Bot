import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import axios from 'axios';
import db from '../../Events/loadDatabase.js';

export const command = {
    name: 'fivem',
    sname: 'fivem',
    aliases: ['fx'],
    description: 'Affiche le statut détaillé du serveur FiveM',
    run: async (bot, message, args, config) => {

        const checkPerm = async (message, commandName) => {
            if (config.owners.includes(message.author.id)) return true;
            const wl = await new Promise(resolve => db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => resolve(!!row)));
            if (wl) return true;
            const owner = await new Promise(resolve => db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => resolve(!!row)));
            if (owner) return true;
            return false;
        };

        if (!(await checkPerm(message, 'fivem'))) {
            return message.reply("Vous n'avez pas la permission d'utiliser cette commande.").then(m => setTimeout(() => m.delete().catch(() => { }), 3000));
        }

        const cfxId = args[0];
        const discordLink = "https://discord.gg/";

        if (!cfxId) return message.reply("`❌` Aucun ID FiveM trouvé (utilisez `fivem [ID]`).");

        const url = `https://servers-frontend.fivem.net/api/servers/single/${cfxId}`;

        try {
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = response.data.Data;
            const hostname = data.hostname.replace(/\^[0-9]/g, '').trim();

            const embed = new EmbedBuilder()
                .setTitle(`${hostname.slice(0, 250)}`)
                .setColor(config.color)
                .setThumbnail(`https://servers-live.fivem.net/servers/icon/${cfxId}.png`)
                .setDescription(
                    `**Connexion via F8**\n` +
                    `\`\`\`connect cfx.re/join/${cfxId}\`\`\`\n` +
                    `**Statut** : 🟢 Online \n\n` +
                    `**Joueurs** : \` ${data.clients}/${data.sv_maxclients} \` \n` +
                    `**Moyenne Ping** : \` ${data.players[0]?.ping || 0} ms \``
                )
                .setFooter({ text: `CFX-ID: ${cfxId}`, iconURL: bot.user.displayAvatarURL() })
                .setTimestamp();

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

            if (message.deletable) message.delete().catch(() => {});

        } catch (e) {
            console.error(e);
            message.reply("`❌` Impossible de récupérer les infos du serveur. Vérifiez l'ID.");
        }
    }
};