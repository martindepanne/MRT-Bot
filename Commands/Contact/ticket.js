import { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuOptionBuilder, ButtonStyle } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import configData from '../../config.json' with { type: 'json' };
import sendLog from '../../Events/sendlog.js';
import * as Discord from "discord.js";

export const command = {
    name: 'ticket',
    helpname: 'ticket <catégorie id>',
    description: 'Permet de configurer la catégorie des tickets',
    help: 'ticket <catégorie id>',
    run: async (bot, message, args, config) => {
        const checkPerm = async (message, commandName) => {
            if (configData.owners.includes(message.author.id)) {
                return true;
            }

            const publicStatut = await new Promise((resolve) => {
                db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
                    resolve(!!row);
                });
            });

            if (publicStatut) {
                const checkPublicCmd = await new Promise((resolve) => {
                    db.get(
                        'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
                        ['public', commandName, message.guild.id],
                        (err, row) => {
                            resolve(!!row);
                        }
                    );
                });

                if (checkPublicCmd) {
                    return true;
                }
            }

            try {
                const checkUserWl = await new Promise((resolve) => {
                    db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
                        resolve(!!row);
                    });
                });

                if (checkUserWl) {
                    return true;
                }

                const checkDbOwner = await new Promise((resolve) => {
                    db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
                        resolve(!!row);
                    });
                });

                if (checkDbOwner) {
                    return true;
                }

                const roles = message.member.roles.cache.map(role => role.id);

                const permissions = await new Promise((resolve) => {
                    db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.perm) : []);
                    });
                });

                if (permissions.length === 0) {
                    return false;
                }

                const checkCmdPermLevel = await new Promise((resolve) => {
                    db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.command) : []);
                    });
                });

                return checkCmdPermLevel.includes(commandName);
            } catch (error) {
                return false;
            }
        };

        if (!(await checkPerm(message, command.name))) {
            const noacces = new EmbedBuilder()
                .setDescription("Vous n'avez pas la permission d'utiliser cette commande")
                .setColor(configData.color);
            return message.reply({ embeds: [noacces] }).then(m => setTimeout(() => m.delete().catch(() => { }), 2000));
        }

        const category = message.guild.channels.cache.get(args[0]);
        if (!category || category.type !== 4) {
            return message.reply({ content: "ID Catégorie invalide (ID d'une catégorie attendu)." });
        }

        db.run(`CREATE TABLE IF NOT EXISTS ticket (guild TEXT PRIMARY KEY, category TEXT)`, [], () => {
            db.run(`INSERT OR REPLACE INTO ticket (guild, category) VALUES (?, ?)`, [message.guild.id, category.id]);
        });

        const ticketConfig = configData.ticket;
        const opts = ticketConfig.options;

        const options = [
            { key: 'option1', label: opts.option1 },
            { key: 'option2', label: opts.option2 },
            { key: 'option3', label: opts.option3 },
            { key: 'option4', label: opts.option4 }
        ].filter(opt => opt.label && opt.label.trim() !== '');

        if (options.length === 0) {
            return message.reply({ content: 'Aucune option pour le ticket n\'est configurée dans l\'objet "ticket.options" de votre config.json' });
        }

        const ticketMenu = new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Choisissez une option')
            .addOptions(
                options.map(opt => ({
                    label: opt.label,
                    value: opt.key
                }))
            );

        const embed = new EmbedBuilder();
        if (ticketConfig.titre) embed.setTitle(ticketConfig.titre);
        embed.setDescription(ticketConfig.description || "Ouvrez un ticket");
        embed.setColor(configData.color || "#96480C");
        
        let icon = message.guild.iconURL({ dynamic: true });
        if (ticketConfig.footer) {
            embed.setFooter({ text: ticketConfig.footer, iconURL: icon });
        }

        await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(ticketMenu)] });
    },
};