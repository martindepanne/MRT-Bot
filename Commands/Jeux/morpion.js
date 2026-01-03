import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
    name: 'morpion',
    sname: 'morpion',
    aliases: ['ttt', 'tictactoe'],
    description: 'Permet de jouer au morpion contre l\'IA ou un ami',
    use: 'morpion [@user]',
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
                console.error('Erreur permissions Morpion:', error);
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
            if (opponent.bot || opponent.id === message.author.id) {
                return message.reply("Vous ne pouvez pas jouer contre un bot ou contre vous-même !");
            }
            
            const MorpionClass = (await import('../../Games/Morpion.js')).default;
            const game = new MorpionClass({
                message: message,
                opponent: opponent,
                xEmoji: '❌',
                oEmoji: '⭕'
            });
            return game.start();
        }

        const menuEmbed = new EmbedBuilder()
            .setTitle("🎮 Duel contre l'IA")
            .setDescription("Veuillez choisir le niveau de difficulté de l'IA pour commencer la partie en solo.")
            .setColor(config.color)
            .setFooter({ text: "Pour jouer contre un ami, mentionnez-le : +morpion @ami" });

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('ttt_difficulty_select')
                .setPlaceholder('Choisir la difficulté')
                .addOptions([
                    { label: 'Facile', value: 'easy', description: 'L\'IA joue au hasard.', emoji: '🟢' },
                    { label: 'Normal', value: 'normal', description: 'L\'IA essaie de bloquer vos coups.', emoji: '🟡' },
                    { label: 'Expert', value: 'hard', description: 'L\'IA est imbattable (Minimax).', emoji: '🔴' }
                ])
        );

        message.reply({ embeds: [menuEmbed], components: [menuRow] });
    }
}