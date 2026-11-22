export function createRideSoundEvents(operations, audio) {
  const { announcementPoints, boarding } = operations.config;
  const announcements = Object.entries(announcementPoints ?? {});
  let previousAlong, previousGreen;

  function reset(along) {
    previousAlong = along;
  }

  function update({ phase, along, riderDistance, queue, staffArea, quiet, skiing }) {
    if (phase === 'riding' && !staffArea && !quiet && !skiing) {
      if (operations.towerBetween(previousAlong, along) !== undefined) {
        audio.towerPass(operations.speedAt(riderDistance));
      }
      for (const [name, point] of announcements) {
        if (previousAlong < point && along >= point) audio.announce(name);
      }
    }
    previousAlong = along;

    const nearBoarding = staffArea === 'boarding' || (!staffArea && !skiing
      && (phase === 'waiting' || phase === 'boarding' || (phase === 'riding' && Math.abs(along - boarding) < 20)));
    if (previousGreen === false && queue.green && nearBoarding && !quiet) audio.boardingChime();
    previousGreen = queue.green;
  }

  return { reset, update };
}
