import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import config from "../config.json" with { type: 'json' };
import db from "../Events/loadDatabase.js";

class Dames {
    constructor(options) {
        this.message = options.message;
        this.config = config;
        this.player1 = options.user || options.message.author;
        this.player2 = options.opponent || null;
        this.difficulty = options.difficulty || 'normal';
        this.isAi = !options.opponent;
        
        this.board = this.createInitialBoard();
        this.turn = 'W'; 
        this.selected = null;
        this.lastMove = "La partie commence !";
        this.symbols = {
            0: '⬛', 1: '⚪', 2: '🔴', 3: '⭐', 4: '🌟', 'bg': '🟫'
        };
    }

    async updateStats(userId) {
        db.get('SELECT userId FROM profiles WHERE userId = ?', [userId], (err, row) => {
            if (err) return console.error(err);
            if (!row) {
                db.run('INSERT INTO profiles (userId, guildId, dames_wins) VALUES (?, ?, 1)', [userId, this.message.guild.id]);
            } else {
                db.run('UPDATE profiles SET dames_wins = dames_wins + 1 WHERE userId = ?', [userId]);
            }
        });
    }

    createInitialBoard() {
        let b = Array(8).fill(null).map(() => Array(8).fill(0));
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if ((r + c) % 2 !== 0) {
                    if (r < 3) b[r][c] = 2; 
                    else if (r > 4) b[r][c] = 1;
                } else { b[r][c] = 'bg'; }
            }
        }
        return b;
    }

    renderBoard() {
        const letters = ['⬛', '🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭'];
        const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        let str = letters.join('\u200b') + '\n';
        for (let r = 0; r < 8; r++) {
            str += numbers[r];
            for (let c = 0; c < 8; c++) {
                str += this.symbols[this.board[r][c]];
            }
            str += '\n';
        }
        return str;
    }

    sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async start() {
        const gameMessage = await this.message.channel.send({
            embeds: [this.createEmbed()],
            components: this.createComponents()
        });

        const collector = gameMessage.createMessageComponentCollector({ time: 600000 });

        collector.on('collect', async (i) => {
            const currentPlayer = this.turn === 'W' ? this.player1 : this.player2;

            if (i.user.id !== currentPlayer.id) {
                return i.reply({ content: `C'est au tour de ${currentPlayer.username} !`, ephemeral: true });
            }

            const [action, r, c] = i.values[0].split('_');
            const row = parseInt(r), col = parseInt(c);

            if (action === 'sel') {
                this.selected = (this.selected && this.selected.r === row && this.selected.c === col) ? null : { r: row, c: col };
                return await i.update({ embeds: [this.createEmbed(this.selected ? "Choisissez la destination..." : null)], components: this.createComponents() });
            } else {
                const fromCoord = `${String.fromCharCode(65 + this.selected.c)}${this.selected.r + 1}`;
                const toCoord = `${String.fromCharCode(65 + col)}${row + 1}`;
                
                this.movePiece(this.selected.r, this.selected.c, row, col);
                this.lastMove = `${this.turn === 'W' ? '⚪' : '🔴'} **${i.user.username}** : **${fromCoord}** ➔ **${toCoord}**.`;
                this.selected = null;
                this.turn = this.turn === 'W' ? 'B' : 'W';

                if (this.isAi && this.turn === 'B') {
                    await i.update({ embeds: [this.createEmbed("L'IA réfléchit... 🧠")], components: this.createComponents(true) });
                    
                    await this.sleep(1500);
                    const iaLog = this.makeMoveIA();
                    this.lastMove = iaLog;
                    this.turn = 'W';

                    if (iaLog.includes("gagné")) {
                        this.updateStats(this.player1.id);
                        return await gameMessage.edit({ embeds: [this.createEmbed("Partie terminée !")], components: [] });
                    }

                    return await gameMessage.edit({ embeds: [this.createEmbed()], components: this.createComponents() });
                }

                await i.update({ embeds: [this.createEmbed()], components: this.createComponents() });
            }
        });
    }

    movePiece(fromR, fromC, toR, toC) {
        const dr = toR - fromR;
        const dc = toC - fromC;
        const dist = Math.abs(dr);
        
        if (dist > 1) {
            const stepR = dr / dist;
            const stepC = dc / dist;
            for (let i = 1; i < dist; i++) {
                this.board[fromR + (stepR * i)][fromC + (stepC * i)] = 0;
            }
        }

        this.board[toR][toC] = this.board[fromR][fromC];
        this.board[fromR][fromC] = 0;

        if (toR === 0 && this.board[toR][toC] === 1) this.board[toR][toC] = 3;
        if (toR === 7 && this.board[toR][toC] === 2) this.board[toR][toC] = 4;
    }

    getValidMoves(r, c) {
        const moves = [];
        const piece = this.board[r][c];
        const isKing = (piece === 3 || piece === 4);
        const isWhite = (piece === 1 || piece === 3);
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

        for (let [dr, dc] of directions) {
            if (!isKing && isWhite && dr > 0) continue;
            if (!isKing && !isWhite && dr < 0) continue;

            for (let dist = 1; dist < 8; dist++) {
                let nr = r + dr * dist;
                let nc = c + dc * dist;
                if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8 || this.board[nr][nc] === 'bg') break;
                if (this.board[nr][nc] === 0) {
                    moves.push({ fR: r, fC: c, tR: nr, tC: nc, kill: false });
                    if (!isKing) break;
                } else {
                    const isMidWhite = (this.board[nr][nc] === 1 || this.board[nr][nc] === 3);
                    if (isWhite !== isMidWhite) {
                        let jr = nr + dr, jc = nc + dc;
                        if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && this.board[jr][jc] === 0) {
                            moves.push({ fR: r, fC: c, tR: jr, tC: jc, kill: true });
                        }
                    }
                    break;
                }
            }
        }
        return moves;
    }

    makeMoveIA() {
        let allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === 2 || this.board[r][c] === 4) allMoves.push(...this.getValidMoves(r, c));
            }
        }
        if (allMoves.length === 0) return "IA bloquée ! Vous avez gagné.";
        const kills = allMoves.filter(m => m.kill);
        const selected = (this.difficulty !== 'easy' && kills.length > 0) ? kills[Math.floor(Math.random() * kills.length)] : allMoves[Math.floor(Math.random() * allMoves.length)];
        const from = `${String.fromCharCode(65 + selected.fC)}${selected.fR + 1}`, to = `${String.fromCharCode(65 + selected.tC)}${selected.tR + 1}`;
        this.movePiece(selected.fR, selected.fC, selected.tR, selected.tC);
        return selected.kill ? `🤖 **IA** : capture en **${to}** ! ⚔️` : `🤖 **IA** : **${from}** ➔ **${to}**.`;
    }

    createEmbed(status) {
        const turnLabel = this.turn === 'W' ? `Blanc (${this.player1.username})` : `Rouge (${this.isAi ? 'IA' : this.player2.username})`;
        return new EmbedBuilder()
            .setColor(this.config.color)
            .setTitle(`Dames - ${this.isAi ? 'Contre IA (' + this.difficulty + ')' : 'Duel'}`)
            .addFields({ name: 'Dernière action', value: this.lastMove }, { name: 'Au tour de', value: turnLabel })
            .setDescription(`${status || "Plateau de jeu :"}\n\n${this.renderBoard()}`)
            .setFooter({ text: `Blancs: ⚪⭐ | Rouges: 🔴🌟` });
    }

    createComponents(disabled = false) {
        const options = [];
        const turnColor = this.turn === 'W' ? [1, 3] : [2, 4];
        if (!this.selected) {
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (turnColor.includes(this.board[r][c])) {
                        const moves = this.getValidMoves(r, c);
                        if (moves.length > 0) options.push({ label: `Pion ${String.fromCharCode(65 + c)}${r + 1}`, value: `sel_${r}_${c}` });
                    }
                }
            }
        } else {
            const moves = this.getValidMoves(this.selected.r, this.selected.c);
            for (let m of moves) options.push({ label: `${m.kill ? "⚔️ Capturer" : "📍 Aller"} en ${String.fromCharCode(65 + m.tC)}${m.tR + 1}`, value: `mov_${m.tR}_${m.tC}` });
            options.push({ label: "❌ Annuler", value: `sel_${this.selected.r}_${this.selected.c}` });
        }
        const menu = new StringSelectMenuBuilder().setCustomId('dames_move').setPlaceholder('Sélectionnez un pion...').setDisabled(disabled || (options.length === 0 && !this.selected))
            .addOptions(options.length > 0 ? options.slice(0, 25) : [{ label: "Aucun mouvement", value: "none" }]);
        return [new ActionRowBuilder().addComponents(menu)];
    }
}
export default Dames;