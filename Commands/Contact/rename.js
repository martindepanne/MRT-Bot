import { EmbedBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';
import config from '../../config.json' with { type: 'json' };
import sendLog from '../../Events/sendlog.js';
import * as Discord from "discord.js";

export const command = {
    name: 'rename',
    helpname: 'rename <message>',
    description: 'Permet de renommer un ticket',
    help: 'rename <message>',
    run: async (bot, message, args, config) => {
        const checkPerm = async (message, commandName) => {
            if (config.owners.includes(message.author.id)) {
                return true;
            }

            const publicStatut = await new Promise((resolve, reject) => {
                db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                });
            });

            if (publicStatut) {
                const checkPublicCmd = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
                        ['public', commandName, message.guild.id],
                        (err, row) => {
                            if (err) reject(err);
                            resolve(!!row);
                        }
                    );
                });

                if (checkPublicCmd) {
                    return true;
                }
            }

            try {
                const checkUserWl = await new Promise((resolve, reject) => {
                    db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
                        if (err) reject(err);
                        resolve(!!row);
                    });
                });

                if (checkUserWl) {
                    return true;
                }

                const checkDbOwner = await new Promise((resolve, reject) => {
                    db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
                        if (err) reject(err);
                        resolve(!!row);
                    });
                });

                if (checkDbOwner) {
                    return true;
                }

                const roles = message.member.roles.cache.map(role => role.id);

                const permissions = await new Promise((resolve, reject) => {
                    db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
                        if (err) reject(err);
                        resolve(rows.map(row => row.perm));
                    });
                });

                if (permissions.length === 0) {
                    return false;
                }

                const checkCmdPermLevel = await new Promise((resolve, reject) => {
                    db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
                        if (err) reject(err);
                        resolve(rows.map(row => row.command));
                    });
                });

                return checkCmdPermLevel.includes(commandName);
            } catch (error) {
                console.error('Erreur lors de la vérification des permissions:', error);
                return false;
            }
        };

        if (!(await checkPerm(message, command.name))) {
            const noacces = new EmbedBuilder()
                .setDescription("Vous n'avez pas la permission d'utiliser cette commande")
                .setColor(config.color);
            return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } }).then(m => setTimeout(() => m.delete().catch(() => { }), 2000));
        }

        if (!args[0]) {
            return;
        }

        db.serialize(() => {
            db.run("CREATE TABLE IF NOT EXISTS ticketchannel (channelId TEXT PRIMARY KEY, userId TEXT)");

            db.all("PRAGMA table_info(ticketchannel)", (err, columns) => {
                if (err) return console.error(err);
                
                const hasUserId = columns.some(col => col.name === 'userId');
                
                if (!hasUserId) {
                    db.run("ALTER TABLE ticketchannel ADD COLUMN userId TEXT", (alterErr) => {
                        if (alterErr) {
                            db.run("DROP TABLE ticketchannel", () => {
                                db.run("CREATE TABLE ticketchannel (channelId TEXT PRIMARY KEY, userId TEXT)");
                            });
                        }
                    });
                }

                db.get('SELECT channelId FROM ticketchannel WHERE channelId = ?', [message.channel.id], async (err, row) => {
                    if (err) return console.error(err);

                    if (!row) {
                        return message.reply("Ce salon n’est pas un ticket enregistré.");
                    }

                    const anc = message.channel.name;
                    const nouv = args.join(' ');

                    await message.channel.setName(nouv).catch((e) => { 
                        return message.reply("❌ Erreur : Discord limite le renommage des salons (2 fois toutes les 10 min).");
                    });

                    const embed = new EmbedBuilder()
                        .setDescription(`Le ticket a été renommé en **${nouv}**`)
                        .setColor(config.color);

                    message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });

                    const logs = new Discord.EmbedBuilder()
                        .setColor(config.color)
                        .setTitle("Ticket Renommé")
                        .setDescription(`<@${message.author.id}> a renommé le ticket`)
                        .addFields(
                            { name: "Ancien nom", value: `${anc}`, inline: true },
                            { name: "Nouveau nom", value: `${nouv}`, inline: true },
                            { name: "Salon", value: `<#${message.channel.id}>`, inline: false }
                        )
                        .setTimestamp();

                    sendLog(message.guild, logs, 'ticketlog');
                    sendLog(message.guild, logs, '📁・ticket-logs');
                });
            });
        });
    },
}