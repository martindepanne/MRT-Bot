import { EmbedBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };

export const command = {
    name: 'ticketlog',
    helpname: 'ticketlog <#salon|id>',
    description: 'Configure le salon de logs pour les tickets',
    help: 'ticketlog #salon ou ticketlog <id>',
    run: async (bot, message, args, config) => {

        if (!config.owners.includes(message.author.id)) {
            const noacces = new EmbedBuilder()
                .setDescription("Vous n'avez pas la permission d'utiliser cette commande")
                .setColor(config.color);
            return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } });
        }

        if (!args[0]) return message.reply("❌ Veuillez mentionner un salon ou mettre son ID.");

        let channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);

        if (!channel) return message.reply("❌ Salon invalide.");

        db.run(`CREATE TABLE IF NOT EXISTS logs (guild TEXT PRIMARY KEY, channels TEXT)`, [], () => {
            db.get(`SELECT channels FROM logs WHERE guild = ?`, [message.guild.id], (err, row) => {
                let channelsObj = {};
                if (row && row.channels) {
                    try { channelsObj = JSON.parse(row.channels); } catch {}
                }

                channelsObj["📁・ticket-logs"] = channel.id;

                db.run(
                    `INSERT OR REPLACE INTO logs (guild, channels) VALUES (?, ?)`,
                    [message.guild.id, JSON.stringify(channelsObj)],
                    () => {
                        const embed = new EmbedBuilder()
                            .setDescription(`✅ Salon de logs pour les tickets configuré : ${channel}`)
                            .setColor(config.color);

                        message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
                    }
                );
            });
        });
    }
};