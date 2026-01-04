import { PermissionFlagsBits } from 'discord.js';

export const command = {
  name: 'massiverole',
  description: 'Ajoute un rôle à tous les membres du serveur',
  use: 'massiverole <@role ou ID>',
  run: async (bot, message, args, config) => {
    
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Vous devez être **Administrateur** pour utiliser cette commande.");
    }

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);

    if (!role) {
      return message.reply("❌ Veuillez mentionner un rôle ou donner un ID valide.");
    }

    if (role.position >= message.guild.members.me.roles.highest.position) {
      return message.reply("❌ Je ne peux pas donner ce rôle car il est **supérieur ou égal** au mien dans la liste des rôles.");
    }

    const members = await message.guild.members.fetch();
    const total = members.size;
    
    const msg = await message.reply(`⏳ Début de l'ajout du rôle **${role.name}** à **${total}** membres...`);

    let count = 0;
    let errorCount = 0;

    for (const [id, member] of members) {
      if (member.roles.cache.has(role.id)) continue; 

      try {
        await member.roles.add(role);
        count++;
      } catch (err) {
        errorCount++;
      }
    }

    return msg.edit(`✅ Opération terminée !\n🏆 Rôles ajoutés : **${count}**\n❌ Échecs (bots ou erreurs) : **${errorCount}**`);
  }
};