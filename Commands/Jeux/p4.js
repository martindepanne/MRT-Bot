import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
    name: 'p4',
    sname: 'p4',
    aliases: ['puissance4', 'connect4'],
    description: 'Permet de jouer au Puissance 4 contre l\'IA ou un ami',
    use: 'p4 [@user]',
    run: async (bot, message, args, config) => {
        
        const checkperm = async (message, commandName) => {
            if (config.owners.includes(message.author.id)) return true;

            const publicData = await new Promise((resolve) => {
                db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
                    resolve(!!row);
                });
            });

            if (publicData) {
                const publiccheck = await new Promise((resolve) => {
                    db.get('SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?', ['public', commandName, message.guild.id], (err, row) => {
                        resolve(!!row);
                    });
                });
                if (publiccheck) return true;
            }

            try {
                const userwl = await new Promise((resolve) => {
                    db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => resolve(!!row));
                });
                if (userwl) return true;

                const userowner = await new Promise((resolve) => {
                    db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => resolve(!!row));
                });
                if (userowner) return true;

                const userRoles = message.member.roles.cache.map(role => role.id);
                const permissions = await new Promise((resolve) => {
                    db.all('SELECT perm FROM permissions WHERE id IN (' + userRoles.map(() => '?').join(',') + ') AND guild = ?', [...userRoles, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.perm) : []);
                    });
                });

                if (permissions.length === 0) return false;

                const cmdwl = await new Promise((resolve) => {
                    db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
                        resolve(rows ? rows.map(row => row.command) : []);
                    });
                });

                return cmdwl.includes(commandName);
            } catch (error) {
                console.error('Erreur permissions Puissance 4:', error);
                return false;
            }
        };

        if (!(await checkperm(message, command.name))) {
            const noacces = new EmbedBuilder()
                .setDescription("`❌` Vous n'avez pas la permission d'utiliser cette commande")
                .setColor(config.color);
            return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } });
        }

        const opponent = message.mentions.users.first();

        if (opponent) {
            if (opponent.id === message.author.id) return message.reply("Vous ne pouvez pas vous défier vous-même !");
            if (opponent.bot) return message.reply("Vous ne pouvez pas défier un bot (jouez sans mention pour affronter l'IA) !");

            const Puissance4Class = (await import('../../Games/Puissance4.js')).default;
            const game = new Puissance4Class({
                message: message,
                opponent: opponent
            });
            return game.start();
        }

        const menuEmbed = new EmbedBuilder()
            .setTitle("🟡 Puissance 4 - IA")
            .setDescription("Choisissez le niveau de l'IA pour commencer votre partie en solo.")
            .setColor(config.color)
            .setFooter({ text: "Pour défier un ami : +p4 @user" });

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('p4_difficulty_select')
                .setPlaceholder('Niveau de difficulté')
                .addOptions([
                    { label: 'Débutant', value: 'easy', description: 'L\'IA joue au hasard.', emoji: '🟢' },
                    { label: 'Intermédiaire', value: 'normal', description: 'L\'IA bloque vos alignements.', emoji: '🟡' },
                    { label: 'Expert', value: 'hard', description: 'L\'IA anticipe vos coups.', emoji: '🔴' }
                ])
        );

        message.reply({ embeds: [menuEmbed], components: [menuRow] });
    },
};