import { ActivityType, Events } from "discord.js";

export default {
    // Utiliser la constante au lieu de la chaîne de caractères
    name: Events.ClientReady, 
    once: true, // L'événement ready ne doit s'exécuter qu'une seule fois
    async execute(bot) {
        // Enregistrement des slash commands
        if (bot.arrayOfSlashCommands) {
            await bot.application.commands.set(bot.arrayOfSlashCommands);
        }

bot.user.setPresence({
    activities: [{ 
        name: 'MRT-Bot', // Le texte affiché
        type: ActivityType.Streaming, 
        url: 'https://twitch.tv/martindepanne' // Lien Twitch/YouTube (obligatoire uniquement pour le type Streaming)
    }], 
    status: 'online'
});

/* DÉTAILS DES TYPES D'ACTIVITÉS (ActivityType) :
   - ActivityType.Playing   : "Joue à..."
   - ActivityType.Streaming : "En direct sur..." 
   - ActivityType.Listening : "Écoute..."
   - ActivityType.Watching  : "Regarde..."
   - ActivityType.Competing : "Participe à..."

   DÉTAILS DES STATUTS (status) :
   - 'online'    : En ligne
   - 'idle'      : Inactif (AFK)
   - 'dnd'       : Ne pas déranger
   - 'invisible' : Apparaît hors-ligne
*/
        
        console.log(`[READY] ${bot.user.tag} est opérationnel.`);
    }
};