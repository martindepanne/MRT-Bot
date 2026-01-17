import * as Discord from "discord.js";
import db from "../../Events/loadDatabase.js";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const command = {
    name: 'poj',
    helpname: 'poj',
    description: 'Affiche le panel de configuration Ping On Join',
    run: async (bot, message, args, config) => {
        const checkPerm = async (message) => {
            if (config.owners.includes(message.author.id)) return true;
            return new Promise((resolve) => {
                db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => resolve(!!row));
            });
        };

        if (!(await checkPerm(message))) return;

        db.all('SELECT * FROM poj WHERE guildId = ?', [message.guild.id], (err, rows) => {
            const hasPoj = rows && rows.length > 0;
            const channelsList = hasPoj ? rows.map(row => `<#${row.channelId}>`).join('\n') : "Aucun salon";
            const currentMsg = hasPoj ? rows[0].message : "{user}";
            const currentTime = hasPoj ? rows[0].time / 1000 : 5;

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Configuration Ping On Join")
                .setColor(config.color)
                .addFields(
                    { name: "📍 Salons Actifs", value: channelsList },
                    { name: "💬 Message", value: `\`${currentMsg}\`` },
                    { name: "⏱️ Suppression", value: `\`${currentTime}s\`` }
                );

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('poj_add').setLabel('Ajouter').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('poj_del').setLabel('Retirer').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('poj_test').setLabel('Tester').setStyle(ButtonStyle.Success)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('poj_edit_msg').setLabel('Message').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('poj_edit_time').setLabel('Temps').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('poj_off').setLabel('Désactiver').setStyle(ButtonStyle.Danger)
            );

            message.reply({ embeds: [embed], components: [row1, row2] });
        });
    }
};