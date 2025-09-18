export const name = 'spin';
export const version = '2.0.0';

export function evalChannels(spec, p, ctx) {
  const turns = Number(spec?.params?.fullTurns ?? 1);
  return { rot: 360 * p * turns };
}
