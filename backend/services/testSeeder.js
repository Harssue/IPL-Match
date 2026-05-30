/**
 * testSeeder.js
 * Seeds a complete test game with 10 IPL teams populated exactly
 * from the ipl_2026_squads.json squads file.
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { AGame, AGameTeam, ATeam, AUser, APlayer, ASquad } = require('../auctionDb');

// logoInitials map
const LOGO_MAP = {
  CSK: 'CSK', MI: 'MI', RCB: 'RCB', KKR: 'KKR', RR: 'RR',
  DC: 'DC', PBKS: 'PK', SRH: 'SRH', LSG: 'LSG', GT: 'GT',
};

function rndInt(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

async function seedTestGame() {
  // 1. Grab host user
  const hostUser = await AUser.findOne({ order: [['createdAt', 'ASC']] });
  if (!hostUser) {
    throw new Error('No users found in DB. Register at least one user in the main app first.');
  }

  // 2. Grab all 10 teams
  const teams = await ATeam.findAll({ order: [['id', 'ASC']], limit: 10 });
  if (teams.length < 2) {
    throw new Error('Teams table is empty. Run the main IPL app to seed teams.');
  }

  // 3. Load real players from players.json to build a nationality lookup map
  const playersPath = path.resolve(__dirname, '../data/players.json');
  const nationalityMap = {};
  try {
    const raw = fs.readFileSync(playersPath, 'utf8');
    const realPlayers = JSON.parse(raw);
    realPlayers.forEach((p) => {
      nationalityMap[p.name] = p.nationality;
    });
  } catch (err) {
    console.error('Failed to load players.json for nationality mapping', err);
  }

  // 4. Load squads from ipl_2026_squads.json
  const squadsPath = path.resolve(__dirname, '../../ipl_2026_squads.json');
  let squadData = null;
  try {
    const raw = fs.readFileSync(squadsPath, 'utf8');
    squadData = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load ipl_2026_squads.json', err);
    throw new Error('Squads JSON data file not found at ' + squadsPath);
  }

  // 5. Create Game row
  const lobbyCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const game = await AGame.create({
    id:          uuidv4(),
    lobbyCode,
    status:      'test',
    hostUserId:  hostUser.id,
    maxPlayers:  10,
  });

  // 6. Generate squad for each of the 10 teams based on ipl_2026_squads.json
  const gameTeamRows = [];

  for (const team of teams) {
    // Match the database team to the json team
    const jsonTeam = squadData.teams.find(
      (jt) => jt.short_name === team.shortName ||
              jt.team.toLowerCase().includes(team.name.toLowerCase()) ||
              team.name.toLowerCase().includes(jt.team.toLowerCase())
    );

    if (!jsonTeam) {
      throw new Error(`Team ${team.name} not found in ipl_2026_squads.json`);
    }

    const squadSize = jsonTeam.players.length;
    
    // Resolve players roles and nationalities
    let overseasCount = 0;
    const playersToCreate = jsonTeam.players.map((p) => {
      // Map JSON role to standard database roles
      let mappedRole = p.role;
      if (p.role === 'Batter') mappedRole = 'Batsman';
      else if (p.role === 'Wicketkeeper-Batter') mappedRole = 'Wicketkeeper';

      const nationality = nationalityMap[p.name] || 'Indian';
      if (nationality === 'Overseas') {
        overseasCount++;
      }

      return {
        name: p.name,
        role: mappedRole,
        nationality,
        battingStyle: p.batting_style,
        bowlingStyle: p.bowling_style || null,
      };
    });

    const gt = await AGameTeam.create({
      id:             uuidv4(),
      gameId:         game.id,
      teamId:         team.id,
      userId:         null,
      isAI:           true,
      purseRemaining: 0,
      squadSize,
      overseasCount,
    });
    gameTeamRows.push({ id: gt.id, teamId: team.id, team });

    for (const p of playersToCreate) {
      const player = await APlayer.create({
        name:         p.name,
        role:         p.role,
        nationality:  p.nationality,
        basePrice:    20000000, // 2 Crores standard base price
        battingStyle: p.battingStyle,
        bowlingStyle: p.bowlingStyle,
      });

      await ASquad.create({
        id:         uuidv4(),
        gameId:     game.id,
        gameTeamId: gt.id,
        playerId:   player.id,
        soldPrice:  rndInt(50, 2000) * 100000,
      });
    }
  }

  return {
    gameId:    game.id,
    lobbyCode: game.lobbyCode,
    teams:     teams.map((t) => ({
      id:           t.id,
      name:         t.name,
      shortName:    t.shortName,
      primaryColor: t.primaryColor || '#f9c000',
      logoInitials: t.logoInitials || LOGO_MAP[t.shortName] || t.shortName,
    })),
    gameTeams: gameTeamRows.map((gt) => ({
      id:     gt.id,
      teamId: gt.teamId,
      team: {
        id:           gt.team.id,
        name:         gt.team.name,
        shortName:    gt.team.shortName,
        primaryColor: gt.team.primaryColor || '#f9c000',
        logoInitials: gt.team.logoInitials || LOGO_MAP[gt.team.shortName] || gt.team.shortName,
      },
    })),
  };
}

module.exports = { seedTestGame };
