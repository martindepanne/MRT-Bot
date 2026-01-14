import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import Discord from "discord.js";
import db from "./loadDatabase.js";
import sendLog from './sendlog.js';
import * as transcript from 'discord-html-transcripts';

export default {
    name: 'interactionCreate',
    async execute(interaction, bot, config) {

        if (interaction.isCommand()) {
            const cmd = bot.slashCommands.get(interaction.commandName);
            if (!cmd) return;

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

            if (interaction.customId === 'ticket_select') {
                const value = interaction.values[0];
                const option = interaction.component.options.find(o => o.value === value);
                const label = option?.label || value;

                db.get('SELECT category FROM ticket WHERE guild = ?', [interaction.guild.id], async (err, row) => {
                    if (err || !row) {
                        return interaction.reply({
                            content: "❌ Aucune catégorie de ticket configurée.",
                            flags: Discord.MessageFlags.Ephemeral
                        });
                    }

                    const channel = await interaction.guild.channels.create({
                        name: `ticket-${label.toLowerCase()}-${interaction.user.username}`,
                        type: Discord.ChannelType.GuildText,
                        parent: row.category,
                        topic: interaction.user.id,
                        permissionOverwrites: [
                            { id: interaction.guild.id, deny: [Discord.PermissionFlagsBits.ViewChannel] },
                            { id: interaction.user.id, allow: [Discord.PermissionFlagsBits.ViewChannel, Discord.PermissionFlagsBits.SendMessages, Discord.PermissionFlagsBits.ReadMessageHistory] }
                        ]
                    });

                    db.serialize(() => {
                        db.run("INSERT OR REPLACE INTO ticketchannel (channelId, userId) VALUES (?, ?)", [channel.id, interaction.user.id]);
                    });

                    const rowBtn = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_close').setLabel('Fermer').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
                        new ButtonBuilder().setCustomId('ticket_rename').setLabel('Renommer').setStyle(ButtonStyle.Secondary).setEmoji('✏️')
                    );

                    const embed = new EmbedBuilder()
                        .setTitle('🎫 Ticket ouvert')
                        .setDescription(`**Type :** ${label}\n**Utilisateur :** <@${interaction.user.id}>\n\nMerci de patienter, un membre du staff va vous répondre.`)
                        .setColor(config.color);

                    await channel.send({ embeds: [embed], components: [rowBtn] });
                    await interaction.reply({ content: `✅ Ton ticket a été créé : ${channel}`, flags: Discord.MessageFlags.Ephemeral });

                    const logEmbed = new EmbedBuilder()
                        .setTitle('Ticket ouvert')
                        .setDescription(`**Salon :** ${channel}\n**Type :** ${label}\n**Utilisateur :** ${interaction.user.tag}`)
                        .setColor(config.color)
                        .setTimestamp();
                    
                    sendLog(interaction.guild, logEmbed, 'ticketlog');
                    sendLog(interaction.guild, logEmbed, '📁・ticket-logs');
                });
            }

            if (interaction.customId === 'ttt_difficulty_select') {
                const rows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        row.addComponents(new ButtonBuilder().setCustomId(`ttt_play_${i * 3 + j}_${difficulty}_${interaction.user.id}`).setLabel('-').setStyle(ButtonStyle.Secondary));
                    }
                    rows.push(row);
                }
                const embed = new EmbedBuilder().setTitle(`🎮 Morpion - ${difficulty.toUpperCase()}`).setDescription(`C'est à <@${interaction.user.id}> !`).setColor(config.color);
                return await interaction.update({ embeds: [embed], components: rows });
            }

            if (interaction.customId === 'dames_difficulty_select') {
                const DamesClass = (await import('../Games/Dames.js')).default;
                const game = new DamesClass({ message: interaction.message, user: interaction.user, opponent: null, difficulty: difficulty });
                await interaction.update({ content: `Dames - Niveau : **${difficulty.toUpperCase()}**`, embeds: [], components: [] });
                return game.start();
            }

            if (interaction.customId === 'p4_difficulty_select') {
                const P4Class = (await import('../Games/Puissance4.js')).default;
                const game = new P4Class({ message: interaction.message, user: interaction.user, opponent: null, difficulty: difficulty });
                await interaction.update({ content: `Puissance 4 - Niveau : **${difficulty.toUpperCase()}**`, embeds: [], components: [] });
                return game.start();
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'ticket_close') {
                await interaction.reply({ content: "Génération du transcript et fermeture...", flags: Discord.MessageFlags.Ephemeral });

                const attachment = await transcript.createTranscript(interaction.channel, {
                    limit: -1,
                    fileName: `transcript-${interaction.channel.name}.html`,
                    poweredBy: false
                });

                const logEmbed = new EmbedBuilder()
                    .setTitle('Ticket fermé & Archivé')
                    .setDescription(`**Ticket :** ${interaction.channel.name}\n**Fermé par :** ${interaction.user.tag}`)
                    .setColor('#ff0000')
                    .setTimestamp();

                try {
                    await interaction.user.send({ 
                        content: `Voici le transcript de votre ticket sur **${interaction.guild.name}**`, 
                        files: [attachment] 
                    }).catch(() => {});
                } catch (e) {}

                db.get('SELECT channels FROM logs WHERE guild = ?', [interaction.guild.id], (err, row) => {
                    if (row) {
                        const channelsObj = JSON.parse(row.channels);
                        const logChannelId = channelsObj['📁・ticket-logs'] || channelsObj['ticketlog'];
                        const logChannel = interaction.guild.channels.cache.get(logChannelId);
                        if (logChannel) logChannel.send({ embeds: [logEmbed], files: [attachment] });
                    }
                });

                db.run('DELETE FROM ticketchannel WHERE channelId = ?', [interaction.channel.id]);
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
            }

            if (interaction.customId === 'ticket_rename') {
                const modal = new ModalBuilder().setCustomId('modal_ticket_rename').setTitle('Renommer le ticket');
                const input = new TextInputBuilder().setCustomId('new_name').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'open_recherche_modal') {
                const modal = new ModalBuilder().setTitle('Menu de recherche').setCustomId('recherche_menu');
                const recherche = new TextInputBuilder().setLabel('🍿・Titre du film').setCustomId('film_name').setPlaceholder('Exemple: Inception').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(recherche));
                return await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('ttt_play_')) {
                const [, , indexStr, level, ownerId] = interaction.customId.split('_');
                if (interaction.user.id !== ownerId) return interaction.reply({ content: "❌ Ce n'est pas votre partie !", flags: 64 });

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
                    if (level === 'easy') move = empty[Math.floor(Math.random() * empty.length)];
                    else {
                        const block = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]].find(l => {
                            const v = l.map(i => board[i]);
                            return v.filter(x => x === 'X').length === 2 && v.includes(null);
                        });
                        move = block ? block.find(i => board[i] === null) : empty[Math.floor(Math.random() * empty.length)];
                    }
                    if (move !== undefined) board[move] = 'O';
                    winner = checkWin(board);
                }

                const updateRows = [];
                for (let i = 0; i < 3; i++) {
                    const row = new ActionRowBuilder();
                    for (let j = 0; j < 3; j++) {
                        const idx = i * 3 + j;
                        row.addComponents(new ButtonBuilder().setCustomId(`ttt_play_${idx}_${level}_${ownerId}`).setLabel(board[idx] || '-').setStyle(board[idx] === 'X' ? ButtonStyle.Primary : board[idx] === 'O' ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(!!winner || board[idx] !== null));
                    }
                    updateRows.push(row);
                }
                const status = winner === 'X' ? '🏆 Gagné !' : winner === 'O' ? '💀 Perdu...' : winner === 'tie' ? '🤝 Nul !' : 'À vous !';
                return await interaction.update({ embeds: [new EmbedBuilder().setTitle(`Morpion`).setDescription(status).setColor(config.color)], components: updateRows });
            }

            if (interaction.customId === 'open_verify_modal') {
                const modal = new ModalBuilder().setCustomId('modal_verify_setup').setTitle('Configuration OAuth2');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_title').setLabel("Titre").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_desc').setLabel("Description").setStyle(TextInputStyle.Paragraph)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_url').setLabel("Lien").setStyle(TextInputStyle.Short)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v_color').setLabel("Couleur Hex").setStyle(TextInputStyle.Short).setRequired(false))
                );
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'why_verify') return interaction.reply({ content: "Vérification anti-raid.", flags: 64 });
            
            if (interaction.customId === 'confess_open') {
                const modal = new ModalBuilder().setCustomId('confess_modal').setTitle('Confession');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('confess_text').setLabel('Ta confession').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'suggest_open') {
                const modal = new ModalBuilder().setCustomId('suggest_modal').setTitle('Suggestion');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('suggest_text').setLabel('Ta suggestion').setStyle(TextInputStyle.Paragraph).setRequired(true)));
                return interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_ticket_rename') {
                const newName = interaction.fields.getTextInputValue('new_name');
                const oldName = interaction.channel.name;
                
                await interaction.channel.setName(newName).catch(() => {});
                
                const logEmbed = new EmbedBuilder()
                    .setTitle("Ticket Renommé")
                    .setDescription(`<@${interaction.user.id}> a renommé le ticket via le bouton.`)
                    .addFields(
                        { name: "Ancien nom", value: `\`${oldName}\``, inline: true },
                        { name: "Nouveau nom", value: `\`${newName}\``, inline: true }
                    )
                    .setColor(config.color)
                    .setTimestamp();
                
                sendLog(interaction.guild, logEmbed, 'ticketlog');
                sendLog(interaction.guild, logEmbed, '📁・ticket-logs');
                
                return interaction.reply({ content: `✅ Salon renommé : ${newName}`, flags: 64 });
            }

            if (interaction.customId === 'recherche_menu') {
                const query = interaction.fields.getTextInputValue('film_name');
                db.all('SELECT * FROM movies WHERE title LIKE ?', [`%${query}%`], async (err, rows) => {
                    if (err || rows.length === 0) return interaction.reply({ content: "❌ Aucun film trouvé.", flags: 64 });
                    const film = rows[0];
                    const embed = new EmbedBuilder().setTitle(`🎬 ${film.title}`).setDescription(`Voici le résultat trouvé.`).addFields({ name: 'Genre', value: film.genre, inline: true }).setColor(config.color);
                    const btn = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Regarder').setStyle(ButtonStyle.Link).setURL(film.url));
                    return await interaction.reply({ embeds: [embed], components: [btn], flags: 64 });
                });
            }

            if (interaction.customId === 'modal_verify_setup') {
                const title = interaction.fields.getTextInputValue('v_title');
                const desc = interaction.fields.getTextInputValue('v_desc');
                const url = interaction.fields.getTextInputValue('v_url');
                const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(config.color);
                const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Verify now').setURL(url).setStyle(ButtonStyle.Link), new ButtonBuilder().setCustomId('why_verify').setLabel('Why?').setStyle(ButtonStyle.Secondary));
                await interaction.reply({ content: "Embed généré avec succès.", flags: 64 });
                return await interaction.channel.send({ embeds: [embed], components: [row] });
            }

            if (interaction.customId === 'confess_modal') {
                const text = interaction.fields.getTextInputValue('confess_text');
                db.get('SELECT channel FROM Confess WHERE guildId = ?', [interaction.guild.id], async (err, row) => {
                    if (!row || row.channel === 'off') return;
                    const channel = interaction.guild.channels.cache.get(row.channel);
                    const embed = new EmbedBuilder().setTitle(`Confession`).setDescription(text).setColor(config.color);
                    const rowBtn = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confess_open').setLabel('Se confesser').setStyle(ButtonStyle.Primary));
                    await channel.send({ embeds: [embed], components: [rowBtn] });
                    await interaction.reply({ content: "Confession envoyée.", flags: 64 });
                });
            }
        }
    }
};