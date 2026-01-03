import {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import config from "../config.json" with { type: 'json' };
import db from "../Events/loadDatabase.js";

class Morpion {
    constructor(options) {
        if (!options.message) throw new TypeError('Argument manquant : message');
        this.config = config;
        this.message = options.message;
        this.player1 = options.message.author;
        this.player2 = options.opponent || null;
        
        this.board = Array(9).fill(null);
        this.currentPlayer = this.player1;
        this.turn = 'X'; 
        this.symbols = {
            'X': options.xEmoji || '❌',
            'O': options.oEmoji || '⭕',
            'empty': '➖'
        };
    }

    async updateStats(userId) {
        db.get('SELECT userId FROM profiles WHERE userId = ?', [userId], (err, row) => {
            if (err) return console.error(err);
            if (!row) {
                db.run('INSERT INTO profiles (userId, guildId, ttt_wins) VALUES (?, ?, 1)', [userId, this.message.guild.id]);
            } else {
                db.run('UPDATE profiles SET ttt_wins = ttt_wins + 1 WHERE userId = ?', [userId]);
            }
        });
    }

    async start() {
        if (this.player2) {
            const inviteEmbed = new EmbedBuilder()
                .setColor(this.config.color)
                .setTitle("DÉFI AU MORPION ⚔️")
                .setDescription(`Hé ${this.player2}, **${this.player1.username}** te défie au Morpion !\n\nAcceptes-tu le duel ?`)
                .setTimestamp();

            const inviteRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('accept').setLabel('Accepter').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('deny').setLabel('Refuser').setStyle(ButtonStyle.Danger)
            );

            const inviteMsg = await this.message.channel.send({
                content: `<@${this.player2.id}>`,
                embeds: [inviteEmbed],
                components: [inviteRow]
            });

            try {
                const confirmation = await inviteMsg.awaitMessageComponent({
                    filter: i => i.user.id === this.player2.id,
                    time: 30000,
                    componentType: ComponentType.Button
                });

                if (confirmation.customId === 'deny') {
                    return inviteMsg.edit({ content: null, embeds: [inviteEmbed.setDescription("❌ Le défi a été refusé.")], components: [] });
                }
                
                await confirmation.deferUpdate();
                await inviteMsg.delete().catch(() => {});
            } catch (e) {
                return inviteMsg.edit({ content: null, embeds: [inviteEmbed.setDescription("⏰ Temps écoulé, l'invitation a expiré.")], components: [] });
            }
        }

        const gameMessage = await this.message.channel.send({
            embeds: [this.createEmbed()],
            components: this.createComponents()
        });

        const collector = gameMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000, 
            filter: i => {
                if (!this.player2) return i.user.id === this.player1.id;
                return i.user.id === this.currentPlayer.id;
            }
        });

        collector.on('collect', async (interaction) => {
            const index = parseInt(interaction.customId.split('_')[1]);

            if (this.board[index] !== null) {
                return interaction.reply({ content: "Cette case est déjà prise !", ephemeral: true });
            }

            this.board[index] = this.turn;
            
            if (this.checkWin(this.turn)) {
                this.updateStats(this.currentPlayer.id);
                return collector.stop('win');
            } 
            
            if (this.board.every(cell => cell !== null)) {
                return collector.stop('draw');
            }

            if (this.player2) {
                this.turn = this.turn === 'X' ? 'O' : 'X';
                this.currentPlayer = this.turn === 'X' ? this.player1 : this.player2;
            } else {
                this.makeMoveIA();
                if (this.checkWin('O')) return collector.stop('lose');
                if (this.board.every(cell => cell !== null)) return collector.stop('draw');
            }

            await interaction.update({
                embeds: [this.createEmbed()],
                components: this.createComponents()
            });
        });

        collector.on('end', (collected, reason) => {
            let status = "Partie terminée";
            if (reason === 'win') status = `✅ **${this.currentPlayer.username}** a gagné !`;
            if (reason === 'lose') status = "❌ L'ordinateur a gagné !";
            if (reason === 'draw') status = "🤝 Égalité !";
            if (reason === 'time') status = "⏰ Temps écoulé !";

            gameMessage.edit({
                embeds: [this.createEmbed(status)],
                components: this.createComponents(true) 
            });
        });
    }

    makeMoveIA() {
        const emptyIndices = this.board.map((v, i) => v === null ? i : null).filter(v => v !== null);
        if (emptyIndices.length > 0) {
            const randomIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
            this.board[randomIndex] = 'O';
        }
    }

    checkWin(symbol) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];
        return winPatterns.some(pattern => pattern.every(index => this.board[index] === symbol));
    }

    createEmbed(status) {
        let description = "";
        if (this.player2) {
            description = `**Tour :** ${this.currentPlayer.username} (${this.turn === 'X' ? this.symbols.X : this.symbols.O})\n\n`;
            description += `${this.symbols.X} : ${this.player1.username}\n${this.symbols.O} : ${this.player2.username}`;
        } else {
            description = `**Statut :** ${status || "À vous de jouer !"}\n\n${this.symbols.X} = Vous\n${this.symbols.O} = IA`;
        }

        return new EmbedBuilder()
            .setColor(this.config.color)
            .setTitle(`Morpion - ${this.player1.username} ${this.player2 ? 'vs ' + this.player2.username : ''}`)
            .setDescription(status && this.player2 ? `**Résultat : ${status}**\n\n${description}` : description)
            .setTimestamp();
    }

    createComponents(disabled = false) {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const index = i * 3 + j;
                const cell = this.board[index];
                
                const button = new ButtonBuilder()
                    .setCustomId(`cell_${index}`)
                    .setLabel(cell ? ' ' : '\u200b') 
                    .setEmoji(cell ? this.symbols[cell] : this.symbols.empty)
                    .setStyle(cell ? (cell === 'X' ? ButtonStyle.Primary : ButtonStyle.Danger) : ButtonStyle.Secondary)
                    .setDisabled(disabled || cell !== null);
                
                row.addComponents(button);
            }
            rows.push(row);
        }
        return rows;
    }
}

export default Morpion;