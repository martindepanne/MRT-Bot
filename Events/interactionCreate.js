import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Discord from "discord.js"
import db from "./loadDatabase.js";

export default {
    name: 'interactionCreate',
    async execute(interaction, bot, config) {

        if (interaction.isCommand()) {
            const cmd = bot.slashCommands.get(interaction.commandName);
            const args = [];
            for (let option of interaction.options.data) {
                if (option.type === 1) {
                    if (option.name) args.push(option.name);
                    option.options?.forEach((x) => {
                        if (x.value) args.push(x.value);
                    });
                } else if (option.value) args.push(option.value);
            }
            cmd.run(bot, interaction, args, config);
            return;
        }

        if (interaction.isStringSelectMenu()) {
            const difficulty = interaction.values[0];

            if (interaction.customId === 'ttt_difficulty_select') {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ttt_play_${i * 3 + j}_${difficulty}_${interaction.user.id}`)
                                .setLabel('-')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    }
                    rows.push(row);
                }

                const embed = new EmbedBuilder()
                    .setTitle(`🎮 Morpion - Niveau ${difficulty.toUpperCase()}`)
                    .setDescription(`C'est à <@${interaction.user.id}> de commencer ! (X)`)
                    .setColor(config.color);

                return await interaction.update({ embeds: [embed], components: rows });
            }

            if (interaction.customId === 'dames_difficulty_select') {
                const DamesClass = (await import('../Games/Dames.js')).default;
                const game = new DamesClass({
                    message: interaction.message,
                    user: interaction.user,
                    opponent: null,
                    difficulty: difficulty
                });

                await interaction.update({
                    content: `La partie de Dames commence ! Niveau : **${difficulty.toUpperCase()}**`,
                    embeds: [],
                    components: []
                });

                return game.start();
            }

            if (interaction.customId === 'p4_difficulty_select') {
                const P4Class = (await import('../Games/Puissance4.js')).default;
                const game = new P4Class({
                    message: interaction.message,
                    user: interaction.user,
                    opponent: null,
                    difficulty: difficulty
                });

                await interaction.update({
                    content: `La partie de Puissance 4 commence ! Niveau : **${difficulty.toUpperCase()}**`,
                    embeds: [],
                    components: []
                });

                return game.start();
            }
        }

        if (interaction.isButton()) {
            
            if (interaction.customId === 'open_recherche_modal') {
                const modal = new ModalBuilder()
                    .setTitle('Menu de recherche')
                    .setCustomId('recherche_menu');

                const recherche = new TextInputBuilder()
                    .setLabel('🍿・Titre de votre film')
                    .setCustomId('film_name')
                    .setPlaceholder('Exemple: Inception')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(recherche));
                return await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('ttt_play_')) {
                const [, , indexStr, level, ownerId] = interaction.customId.split('_');

                if (interaction.user.id !== ownerId) {
                    return interaction.reply({ content: "❌ Ce n'est pas votre partie !", flags: Discord.MessageFlags.Ephemeral });
                }

                const index = parseInt(indexStr);
                const board = interaction.message.components.flatMap(row => row.components.map(b => b.label === '-' ? null : b.label));

                if (board[index]) return;
                board[index] = 'X';

                const checkWin = (b) => {
                    const wins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
                    for (let [a, b1, c] of wins) if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
                    return b.includes(null) ? null : 'tie';
                };

                let winner = checkWin(board);

                if (!winner) {
                    const empty = board.map((v, i) => v === null ? i : null).filter(v => v !== null);
                    let move;

                    if (level === 'easy') {
                        move = empty[Math.floor(Math.random() * empty.length)];
                    } else if (level === 'normal') {
                        const blockMove = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].find(line => {
                            const vals = line.map(i => board[i]);
                            return vals.filter(v => v === 'X').length === 2 && vals.includes(null);
                        });
                        move = blockMove ? blockMove.find(i => board[i] === null) : empty[Math.floor(Math.random() * empty.length)];
                    } else if (level === 'hard') {
                        const minimax = (newBoard, player) => {
                            const avail = newBoard.map((v, i) => v === null ? i : null).filter(v => v !== null);
                            const res = checkWin(newBoard);
                            if (res === 'X') return { score: -10 };
                            if (res === 'O') return { score: 10 };
                            if (res === 'tie') return { score: 0 };
                            const moves = [];
                            for (let i of avail) {
                                newBoard[i] = player;
                                const score = minimax(newBoard, player === 'O' ? 'X' : 'O').score;
                                moves.push({ index: i, score });
                                newBoard[i] = null;
                            }
                            return moves.sort((a, b1) => player === 'O' ? b1.score - a.score : a.score - b1.score)[0];
                        };
                        move = minimax(board, 'O').index;
                    }
                    board[move] = 'O';
                    winner = checkWin(board);
                }

                const updateRows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const idx = i * 3 + j;
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`ttt_play_${idx}_${level}_${ownerId}`)
                                .setLabel(board[idx] || '-')
                                .setStyle(board[idx] === 'X' ? ButtonStyle.Primary : board[idx] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary)
                                .setDisabled(!!winner || board[idx] !== null)
                        );
                    }
                    updateRows.push(row);
                }

                const status = winner === 'X' ? '🏆 Vous avez gagné !' : winner === 'O' ? '💀 L\'IA a gagné...' : winner === 'tie' ? '🤝 Match nul !' : 'À votre tour !';
                return await interaction.update({
                    embeds: [new EmbedBuilder().setTitle(`Morpion - ${level.toUpperCase()}`).setDescription(status).setColor(config.color)],
                    components: updateRows
                });
            }

            if (interaction.customId === 'open_verify_modal') {
                const modal = new ModalBuilder().setCustomId('modal_verify_setup').setTitle('Configuration OAuth2');
                const titleInput = new TextInputBuilder().setCustomId('v_title').setLabel("Titre de l'embed").setStyle(TextInputStyle.Short);
                const descInput = new TextInputBuilder().setCustomId('v_desc').setLabel("Description").setStyle(TextInputStyle.Paragraph);
                const oauthInput = new TextInputBuilder().setCustomId('v_url').setLabel("Lien OAuth2").setStyle(TextInputStyle.Short);
                const colorInput = new TextInputBuilder().setCustomId('v_color').setLabel("Couleur Hex").setStyle(TextInputStyle.Short).setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(oauthInput),
                    new ActionRowBuilder().addComponents(colorInput)
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'why_verify') {
                return await interaction.reply({ content: "Vérification anti-raid.", flags: Discord.MessageFlags.Ephemeral });
            }

            if (interaction.customId === 'confess_open') {
                const modal = new ModalBuilder().setCustomId('confess_modal').setTitle('Confession');
                const input = new TextInputBuilder().setCustomId('confess_text').setLabel('Ta confession').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'suggest_open') {
                const modal = new ModalBuilder().setCustomId('suggest_modal').setTitle('Suggestion');
                const input = new TextInputBuilder().setCustomId('suggest_text').setLabel('Suggestion').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'ticket_close') {
                interaction.channel.delete().catch(() => { });
            }
        }

        if (interaction.isModalSubmit()) {
            
            if (interaction.customId === 'recherche_menu') {
                const filmRecherche = interaction.fields.getTextInputValue('film_name');

                db.all('SELECT * FROM movies WHERE title LIKE ?', [`%${filmRecherche}%`], async (err, rows) => {
                    if (err) {
                        console.error(err);
                        return interaction.reply({ content: "Erreur base de données.", flags: 64 });
                    }

                    if (rows.length === 0) {
                        return interaction.reply({ content: `❌ Aucun film trouvé pour "${filmRecherche}".`, flags: 64 });
                    }

                    const film = rows[0]; 
                    const embed = new EmbedBuilder()
                        .setTitle(`🎬 Résultat : ${film.title}`)
                        .setDescription(`Voici le film trouvé dans notre base SQLite.`)
                        .addFields(
                            { name: 'Genre', value: film.genre, inline: true },
                            { name: 'Ajouté par', value: film.addedBy || "Inconnu", inline: true }
                        )
                        .setColor(config.color || 'Blurple');

                    const rowBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setLabel('Regarder maintenant')
                            .setStyle(ButtonStyle.Link)
                            .setURL(film.url)
                    );

                    return await interaction.reply({ embeds: [embed], components: [rowBtn], flags: 64 });
                });
            }

            if (interaction.customId === 'modal_verify_setup') {
                const title = interaction.fields.getTextInputValue('v_title');
                const desc = interaction.fields.getTextInputValue('v_desc');
                const oauthUrl = interaction.fields.getTextInputValue('v_url');
                let color = interaction.fields.getTextInputValue('v_color') || config.color;

                if (color && !color.startsWith('#')) color = `#${color}`;
                const finalEmbed = new EmbedBuilder().setTitle(`🤖 ${title}`).setDescription(desc);

                try { finalEmbed.setColor(color); } catch (e) {
                    return await interaction.reply({ content: `❌ Couleur invalide.`, flags: Discord.MessageFlags.Ephemeral });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Verify now').setURL(oauthUrl).setStyle(ButtonStyle.Link).setEmoji('📤'),
                    new ButtonBuilder().setCustomId('why_verify').setLabel('Why?').setStyle(ButtonStyle.Secondary)
                );

                await interaction.reply({ content: "Embed généré.", flags: Discord.MessageFlags.Ephemeral });
                return await interaction.channel.send({ embeds: [finalEmbed], components: [row] });
            }

            if (interaction.customId === 'confess_modal') {
                const confession = interaction.fields.getTextInputValue('confess_text');
                db.get('SELECT channel FROM Confess WHERE guildId = ?', [interaction.guild.id], async (err, row) => {
                    if (!row || row.channel === 'off') return;
                    const confessChannel = interaction.guild.channels.cache.get(row.channel);
                    const embed = new EmbedBuilder().setTitle(`Confession`).setDescription(confession).setColor(config.color);
                    const rowBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confess_open').setLabel('Se confesser').setStyle(ButtonStyle.Primary));
                    await confessChannel.send({ embeds: [embed], components: [rowBtn] });
                    await interaction.reply({ content: "Envoyé.", flags: 64 });
                });
            }
        }
    }
};