import {
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    ComponentType
} from 'discord.js';
import config from "../config.json" with { type: 'json' };
import db from "../Events/loadDatabase.js";

class Puissance4 {
    constructor(options) {
        if (!options.message) throw new TypeError('Argument manquant : message');
        this.config = config;
        this.message = options.message;
        this.player1 = options.user || options.message.author;
        this.player2 = options.opponent || null;
        this.difficulty = options.difficulty || 'normal';

        this.rows = 6;
        this.cols = 7;
        this.board = Array(this.rows * this.cols).fill(null);
        
        this.currentPlayer = this.player1;
        this.turn = 'R'; 
        this.symbols = {
            'R': '🔴',
            'J': '🟡',
            'empty': '⚫'
        };
    }

    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async updateStats(userId) {
        db.get('SELECT userId FROM profiles WHERE userId = ?', [userId], (err, row) => {
            if (err) return console.error(err);
            if (!row) {
                db.run('INSERT INTO profiles (userId, guildId, p4_wins) VALUES (?, ?, 1)', [userId, this.message.guild.id]);
            } else {
                db.run('UPDATE profiles SET p4_wins = p4_wins + 1 WHERE userId = ?', [userId]);
            }
        });
    }

    async start() {
        if (this.player2) {
            const inviteEmbed = new EmbedBuilder()
                .setColor(this.config.color)
                .setTitle("DÉFI AU PUISSANCE 4 🔴🟡")
                .setDescription(`Hé ${this.player2}, **${this.player1.username}** te défie au Puissance 4 !\n\nAcceptes-tu ?`)
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
                    return inviteMsg.edit({ content: null, embeds: [inviteEmbed.setDescription("❌ Défi refusé.")], components: [] });
                }
                await confirmation.deferUpdate();
                await inviteMsg.delete().catch(() => {});
            } catch (e) {
                return inviteMsg.edit({ content: null, embeds: [inviteEmbed.setDescription("⏰ Invitation expirée.")], components: [] });
            }
        }

        const gameMessage = await this.message.channel.send({
            embeds: [this.createEmbed()],
            components: this.createComponents()
        });

        const collector = gameMessage.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 600000,
            filter: i => {
                if (!this.player2) return i.user.id === this.player1.id;
                return i.user.id === this.currentPlayer.id;
            }
        });

        collector.on('collect', async (interaction) => {
            const col = parseInt(interaction.customId.split('_')[1]);

            let rowToPlace = -1;
            for (let r = this.rows - 1; r >= 0; r--) {
                if (this.board[r * this.cols + col] === null) {
                    rowToPlace = r;
                    break;
                }
            }

            if (rowToPlace === -1) {
                return interaction.reply({ content: "Cette colonne est pleine !", ephemeral: true });
            }

            this.board[rowToPlace * this.cols + col] = this.turn;

            if (this.checkWin(rowToPlace, col, this.turn)) {
                this.updateStats(this.currentPlayer.id);
                return collector.stop('win');
            }
            if (this.board.every(cell => cell !== null)) {
                return collector.stop('draw');
            }

            if (this.player2) {
                this.turn = this.turn === 'R' ? 'J' : 'R';
                this.currentPlayer = this.turn === 'R' ? this.player1 : this.player2;
                
                await interaction.update({
                    embeds: [this.createEmbed()],
                    components: this.createComponents()
                });
            } else {
                await interaction.update({
                    embeds: [this.createEmbed("L'IA réfléchit... 🧠")],
                    components: this.createComponents(true)
                });

                await this.sleep(2000);

                this.makeMoveIA();

                if (this.checkWin(this.lastIARow, this.lastIACol, 'J')) {
                    return collector.stop('lose');
                }
                if (this.board.every(cell => cell !== null)) {
                    return collector.stop('draw');
                }

                await gameMessage.edit({
                    embeds: [this.createEmbed()],
                    components: this.createComponents()
                });
            }
        });

        collector.on('end', (collected, reason) => {
            let status = "Partie terminée";
            if (reason === 'win') status = `✅ **${this.currentPlayer.username}** a gagné !`;
            if (reason === 'lose') status = "❌ L'IA a gagné !";
            if (reason === 'draw') status = "🤝 Égalité !";
            if (reason === 'time') status = "⏰ Temps écoulé !";

            gameMessage.edit({
                embeds: [this.createEmbed(status)],
                components: this.createComponents(true)
            });
        });
    }

    renderBoard() {
        let str = "";
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const cell = this.board[r * this.cols + c];
                str += cell ? this.symbols[cell] : this.symbols.empty;
            }
            str += "\n";
        }
        return str + "1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣";
    }

    createEmbed(status) {
        let desc = this.renderBoard() + "\n\n";
        if (this.player2) {
            desc += `**Tour :** ${this.currentPlayer.username} (${this.turn === 'R' ? '🔴' : '🟡'})\n`;
        } else {
            desc += `**Niveau :** ${this.difficulty.toUpperCase()}\n**Statut :** ${status || "À vous de jouer !"}\n🔴 = Vous | 🟡 = IA`;
        }

        return new EmbedBuilder()
            .setColor(this.config.color)
            .setTitle(`Puissance 4 - ${this.player1.username}`)
            .setDescription(desc);
    }

    createComponents(disabled = false) {
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();

        for (let c = 0; c < this.cols; c++) {
            const btn = new ButtonBuilder()
                .setCustomId(`col_${c}`)
                .setLabel(`${c + 1}`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled || this.board[c] !== null); 

            if (c < 4) row1.addComponents(btn);
            else row2.addComponents(btn);
        }
        return [row1, row2];
    }

    checkWin(r, c, color) {
        const directions = [[0,1], [1,0], [1,1], [1,-1]];
        for (let [dr, dc] of directions) {
            let count = 1;
            for (let i = 1; i < 4; i++) {
                let nr = r + dr * i, nc = c + dc * i;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols || this.board[nr * this.cols + nc] !== color) break;
                count++;
            }
            for (let i = 1; i < 4; i++) {
                let nr = r - dr * i, nc = c - dc * i;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols || this.board[nr * this.cols + nc] !== color) break;
                count++;
            }
            if (count >= 4) return true;
        }
        return false;
    }

    makeMoveIA() {
        const possibleCols = [];
        for (let c = 0; c < this.cols; c++) {
            if (this.board[c] === null) possibleCols.push(c);
        }

        let selectedCol = -1;

        if (this.difficulty !== 'easy') {
            for (const c of possibleCols) {
                const r = this.getLandingRow(c);
                this.board[r * this.cols + c] = 'J';
                if (this.checkWin(r, c, 'J')) {
                    selectedCol = c;
                    this.board[r * this.cols + c] = null;
                    break;
                }
                this.board[r * this.cols + c] = null;
            }

            if (selectedCol === -1) {
                for (const c of possibleCols) {
                    const r = this.getLandingRow(c);
                    this.board[r * this.cols + c] = 'R';
                    if (this.checkWin(r, c, 'R')) {
                        selectedCol = c;
                        this.board[r * this.cols + c] = null;
                        break;
                    }
                    this.board[r * this.cols + c] = null;
                }
            }
        }

        if (selectedCol === -1) {
            selectedCol = possibleCols[Math.floor(Math.random() * possibleCols.length)];
        }

        const row = this.getLandingRow(selectedCol);
        this.board[row * this.cols + selectedCol] = 'J';
        this.lastIARow = row;
        this.lastIACol = selectedCol;
    }

    getLandingRow(col) {
        for (let r = this.rows - 1; r >= 0; r--) {
            if (this.board[r * this.cols + col] === null) return r;
        }
        return -1;
    }
}

export default Puissance4;