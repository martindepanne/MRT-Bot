import { ActivityType } from 'discord.js';
import db from './loadDatabase.js';

export default {
	name: 'guildMemberAdd',
	async execute(member) {

		db.get('SELECT channels FROM ghostping WHERE guild = ?', [member.guild.id], async (err, row) => {
			if (err || !row) return;
			const channelIds = row.channels.split(',').filter(Boolean);
			for (const id of channelIds) {
				const channel = member.guild.channels.cache.get(id);
				if (channel && channel.isTextBased()) {
					try {
						const msg = await channel.send(`<@${member.id}>`);
						setTimeout(() => msg.delete().catch(() => { }), 1500);
					} catch { }
				}
			}
		});

		db.get('SELECT antibot FROM antiraid WHERE guild = ?', [member.guild.id], async (err, row) => {
			if (row && row.antibot === 1 && member.user.bot) {
				try {
					await member.kick('Antibot');
				} catch (error) {
					console.error(`Impossible de kick ${member.user.tag}:`, error);
				}
				return;
			}
		});

		db.all('SELECT * FROM poj WHERE guildId = ?', [member.guild.id], async (err, rows) => {
			if (err || !rows || rows.length === 0) return;

			rows.forEach(async (row) => {
				const channel = member.guild.channels.cache.get(row.channelId);
				if (channel) {
					let content = row.message
						.replace('{user}', `<@${member.id}>`)
						.replace('{guild}', member.guild.name)
						.replace('{count}', member.guild.memberCount);

					try {
						const sent = await channel.send(content);
						if (row.time > 0) {
							setTimeout(() => sent.delete().catch(() => { }), row.time);
						}
					} catch (error) {
						console.error("Erreur d'envoi POJ:", error);
					}
				}
			});
		});

		db.get('SELECT id, texte FROM soutien WHERE guild = ?', [member.guild.id], async (err, row) => {
			if (err || !row) return;
			const soutienRoleId = row.id;
			const soutienText = row.texte;
			const customStatus = member.presence?.activities?.find(a => a.type === ActivityType.Custom);
			function escapeRegExp(string) {
				return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			}
			if (
				customStatus &&
				customStatus.state &&
				new RegExp(`(^|\\s)${escapeRegExp(soutienText)}(\\s|$)`, 'i').test(customStatus.state)
			) {
				try {
					await member.roles.add(soutienRoleId, 'Soutien');
				} catch (e) {
					console.error('Erreur lors de l\'attribution du rôle soutien :', e);
				}
			}
		});
		db.get('SELECT channel, message FROM joinsettings WHERE guildId = ?', [member.guild.id], async (err, row) => {
			if (err || !row || row.channel === 'off') return;
			const channel = member.guild.channels.cache.get(row.channel);
			if (!channel) return;
			let msg = row.message
				.replace(/{user}/g, `<@${member.id}>`)
				.replace(/{user.name}/g, member.user.username)
				.replace(/{user.tag}/g, member.user.tag)
				.replace(/{user.id}/g, member.id)
				.replace(/{guild}/g, member.guild.name)
				.replace(/{guild.memberCount}/g, member.guild.memberCount);
			channel.send({ content: msg }).catch(() => { });
		});
	}
};
