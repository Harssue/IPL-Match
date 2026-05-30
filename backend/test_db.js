const { Fixture } = require('./models');

async function check() {
  try {
    const f = await Fixture.findByPk(454);
    if (!f) {
      console.log('Fixture 454 not found');
      return;
    }
    console.log('Fixture 454 state:');
    console.log({
      id: f.id,
      status: f.status,
      homeTeamId: f.homeTeamId,
      awayTeamId: f.awayTeamId,
      homePlayingXI: f.homePlayingXI,
      awayPlayingXI: f.awayPlayingXI,
      homeImpactSub: f.homeImpactSub,
      awayImpactSub: f.awayImpactSub,
    });
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

check();
