export function createRideSoundEvents(operations, audio) {
  const { announcementPoints, boarding } = operations.config;
  let previousAlong, previousGreen;

  function reset(along) {
    previousAlong = along;
    audio.setStationAnnouncement(null);
  }

  function update({ phase, along, riderDistance, queue, staffArea, quiet, skiing }) {
    if (phase === 'riding' && !staffArea && !quiet && !skiing) {
      if (operations.towerBetween(previousAlong, along) !== undefined) {
        audio.towerPass(operations.speedAt(riderDistance));
      }
    }
    let announcement = null;
    if (announcementPoints && !quiet && !skiing) {
      if (staffArea === 'unloading' || (!staffArea && (
        phase === 'unloading' || phase === 'arrived' ||
        (phase === 'riding' && along >= announcementPoints.unloading - 46)
      ))) {
        announcement = 'unloading';
      } else if (!staffArea && phase === 'riding'
        && along >= announcementPoints.approaching - 65 && along <= announcementPoints.approaching + 26) {
        announcement = 'approaching';
      }
    }
    audio.setStationAnnouncement(announcement);
    previousAlong = along;

    const nearBoarding = staffArea === 'boarding' || (!staffArea && !skiing
      && (phase === 'waiting' || phase === 'boarding' || (phase === 'riding' && Math.abs(along - boarding) < 20)));
    if (previousGreen === false && queue.green && nearBoarding && !quiet) audio.boardingChime();
    previousGreen = queue.green;
  }

  return { reset, update };
}
