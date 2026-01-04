import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const command = {
    name: 'dames',
    sname: 'dames',
    aliases: ['checkers', 'draughts'],
    description: 'Permet de jouer aux dames contre l\'IA ou un ami',
    use: 'dames [@user]',
    run: async (bot, message, args, config) => {

        const opponent = message.mentions.users.first();
        const DamesClass = (await import('../../Games/Dames.js')).default;

        if (opponent) {
            if (opponent.id === message.author.id) return message.reply("`❌` Vous ne pouvez pas jouer contre vous-même.");
            if (opponent.bot) return message.reply("`❌` Vous ne pouvez pas défier un bot.");

            const confirmEmbed = new EmbedBuilder()
                .setTitle("⚔️ Défi aux Dames")
                .setDescription(`<@${opponent.id}>, **${message.author.username}** vous défie aux dames !\nAcceptez-vous le duel ?`)
                .setColor(config.color);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept_game').setLabel('Accepter').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('decline_game').setLabel('Refuser').setStyle(ButtonStyle.Danger)
            );

            const askMsg = await message.reply({ content: `<@${opponent.id}>`, embeds: [confirmEmbed], components: [row] });

            const collector = askMsg.createMessageComponentCollector({
                filter: i => i.user.id === opponent.id,
                time: 60000,
                max: 1
            });

            collector.on('collect', async i => {
                if (i.customId === 'accept_game') {
                    await i.update({ content: "✅ Défi accepté ! La partie commence...", embeds: [], components: [] });
                    const game = new DamesClass({
                        message: message,
                        opponent: opponent,
                        user: message.author
                    });
                    return game.start();
                } else {
                    return i.update({ content: `❌ <@${opponent.id}> a refusé le défi.`, embeds: [], components: [] });
                }
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    askMsg.edit({ content: "⌛ Le temps est écoulé, défi annulé.", embeds: [], components: [] }).catch(() => {});
                }
            });
            
            return;
        }

        const menuEmbed = new EmbedBuilder()
            .setTitle("🏁 Jeu de Dames - IA")
            .setDescription("Choisissez la puissance de l'IA pour commencer.\n\n*Pour défier un ami : `+dames @user`*")
            .setColor(config.color);

        const menuRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('dames_difficulty_init')
                .setPlaceholder('Niveau de difficulté')
                .addOptions([
                    { label: 'Débutant', value: 'easy', emoji: '🟢' },
                    { label: 'Intermédiaire', value: 'normal', emoji: '🟡' },
                    { label: 'Maître', value: 'hard', emoji: '🔴' }
                ])
        );

        const msg = await message.reply({ embeds: [menuEmbed], components: [menuRow] });

        const collectorIA = msg.createMessageComponentCollector({ 
            filter: i => i.user.id === message.author.id, 
            time: 30000,
            max: 1
        });

        collectorIA.on('collect', async i => {
            const game = new DamesClass({
                message: message,
                opponent: null,
                user: message.author,
                difficulty: i.values[0]
            });
            
            await i.update({ content: `🎮 Partie lancée contre l'IA !`, embeds: [], components: [] });
            return game.start();
        });
    }
};