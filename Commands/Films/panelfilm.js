/* eslint-disable no-unused-vars */
import {
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import db from '../../Events/loadDatabase.js';

export const command = {
  name: 'panelfilm',
  description: "Affiche le panel de recherche de films/séries",
  use: 'panelfilm',
  run: async (bot, message, args, config) => {

    db.get('SELECT COUNT(*) AS total FROM movies', [], async (err, rowCount) => {
      if (err) {
        console.error(err);
        return message.reply("❌ Erreur lors de la lecture de la base de données.");
      }

      const totalFilms = rowCount ? rowCount.total : 0;

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setLabel('🔎・Rechercher')
            .setCustomId('open_recherche_modal') // On réutilise l'ID que j'ai mis dans ton interactionCreate
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel('💡・Suggérer')
            .setCustomId('suggest_open') // On réutilise l'ID existant dans ton interactionCreate
            .setStyle(ButtonStyle.Secondary)
        );

      const rechercheEmbed = new EmbedBuilder()
        .setTitle('🍿・Panel de recherche')
        .setDescription(`Les films/séries sont désormais disponibles grâce à ce super bot !\nVous pourrez trouver un total de **${totalFilms}** films/séries sur ce serveur !\n`)
        .addFields({
          name: '🍿・Rechercher un film',
          value: 'Cliquez sur le bouton ci-dessous pour trouver le film de votre choix.',
          inline: false
        }, {
          name: '📝・Vous ne trouvez pas votre film ?',
          value: 'Cliquez sur le bouton ci-dessous pour suggérer le film de votre choix.',
          inline: false
        })
        .setImage('https://media.discordapp.net/attachments/1088472854040940605/1094988284377169920/cfe7ee7c.gif')
        .setColor('Blurple');

      await message.reply({ embeds: [rechercheEmbed], components: [row] });
    });
  }
};