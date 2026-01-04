import { PermissionFlagsBits } from 'discord.js';

export const command = {
  name: 'removerole',
  description: 'Retire un rôle à tous les membres du serveur',
  use: 'removerole <@role ou ID>',
  run: async (bot, message, args, config) => {
    
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Vous devez être **Administrateur**.");
    }

    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[0]);

    if (!role) return message.reply("❌ Rôle invalide.");

    if (role.position >= message.guild.members.me.roles.highest.position) {
      return message.reply("❌ Hiérarchie de rôle insuffisante.");
    }

    const membersWithRole = message.guild.members.cache.filter(m => m.roles.cache.has(role.id));
    const total = membersWithRole.size;

    if (total === 0) {
      return message.reply(`⚠️ Aucun membre n'a été trouvé avec ce rôle dans mon cache.`);
    }

    const msg = await message.reply(`⏳ Retrait du rôle sur **${total}** membres détectés...`);

    let count = 0;
    let errorCount = 0;

    for (const [id, member] of membersWithRole) {
      try {
        await member.roles.remove(role);
        count++;
        
        if (count % 10 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        errorCount++;
      }
    }

    return msg.edit(`✅ Terminé !\n🗑️ Retirés : **${count}**\n❌ Échecs : **${errorCount}**`);
  }
};