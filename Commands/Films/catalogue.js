/* eslint-disable object-shorthand */
/* eslint-disable no-unused-vars */
import {
  EmbedBuilder
} from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
  name: 'catalogue',
  description: 'Permet de voir la liste des films par catégorie',
  use: 'catalogue <categorie>',
  run: async (bot, message, args, config) => {
    
    const categ = args[0]?.toLowerCase();

    const categoriesValides = [
      'netflix', 'disney', 'action', 'horreur', 'comedie', 'anime'
    ];

    if (!categ || !categoriesValides.includes(categ)) {
      return message.reply(`❌ Veuillez préciser une catégorie valide.\n**Options :** ${categoriesValides.join(', ')}`);
    }

    db.all('SELECT * FROM movies WHERE genre = ?', [categ], (err, rows) => {
      if (err) {
        console.error(err);
        return message.reply("❌ Une erreur est survenue lors de la lecture de la base de données.");
      }

      const filmsFiltered = rows.map((film) => {
        return `🆔 \`${film.id}\` | **${film.title}** ([Regarder](${film.url}))`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`🍿 Liste : ${categ.toUpperCase()}`)
        .setDescription(filmsFiltered.join('\n') || '⚠️ Aucun film trouvé dans cette catégorie.')
        .setColor('Blurple')
        .setTimestamp()
        .setFooter({ text: `Demandé par ${message.author.username}` });

      return message.reply({ embeds: [embed] });
    });
  }
};