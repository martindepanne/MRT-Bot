/* eslint-disable no-unused-vars */
import { PermissionFlagsBits } from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
  name: 'delfilm',
  description: 'Supprime un film du catalogue via son ID',
  use: 'delfilm <ID>',
  run: async (bot, message, args, config) => {
    
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Seuls les administrateurs peuvent supprimer des films.");
    }

    const filmId = args[0];
    if (!filmId || isNaN(filmId)) {
      return message.reply("❌ Veuillez préciser l'ID numérique du film (ex: `+delfilm 12`).");
    }

    db.get('SELECT title FROM movies WHERE id = ?', [filmId], (err, row) => {
      if (err) {
        console.error(err);
        return message.reply("❌ Erreur lors de la recherche du film.");
      }

      if (!row) {
        return message.reply(`⚠️ Aucun film trouvé avec l'ID **${filmId}**.`);
      }

      const filmTitle = row.title;

      db.run('DELETE FROM movies WHERE id = ?', [filmId], function(err) {
        if (err) {
          console.error(err);
          return message.reply("❌ Erreur lors de la suppression.");
        }

        return message.reply(`✅ Le film **${filmTitle}** (ID: \`${filmId}\`) a été supprimé avec succès.`);
      });
    });
  }
};